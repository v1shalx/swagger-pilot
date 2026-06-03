import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { SwaggerParserService } from '../swagger-parser/swagger-parser.service';
import { TestGeneratorService } from '../test-generator/test-generator.service';
import { ReporterService } from '../reporter/reporter.service';
import { RunTestsDto, AuthType } from '../swagger-parser/swagger-parser.dto';
import { RunOrchestratorService } from '../run-orchestrator/run-orchestrator.service';
import { FailureDiagnosticsService } from '../diagnostics/failure-diagnostics.service';

@WebSocketGateway({
  cors: {
    origin: "*",
  },
  namespace: "/",
})
export class TestEventsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TestEventsGateway.name);
  private runningJobs = new Map<string, boolean>();

  constructor(
    private readonly swaggerParser: SwaggerParserService,
    private readonly testGenerator: TestGeneratorService,
    private readonly reporter: ReporterService,
    private readonly runOrchestrator: RunOrchestratorService,
    private readonly failureDiagnostics: FailureDiagnosticsService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    client.emit("connected", {
      message: "SwaggerPilot ready",
      geminiConfigured: this.testGenerator.getGeminiService().isConfigured(),
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.runningJobs.delete(client.id);
  }

  @SubscribeMessage("run-tests")
  async handleRunTests(
    @MessageBody() dto: RunTestsDto,
    @ConnectedSocket() client: Socket,
  ) {
    const jobId = client.id;
    this.runningJobs.set(jobId, true);

    try {
      const report = await this.runOrchestrator.executeRun(dto, {
        onStatus: (data) => client.emit("status", data),
        onWarning: (data) => client.emit("warning", { message: data }),
        onTestResult: (result) => client.emit("test-result", result),
        shouldContinue: () => this.runningJobs.get(jobId) === true,
      });

      if (this.runningJobs.get(jobId)) {
        client.emit("complete", { report });
        this.logger.log(
          `Test run complete for ${client.id}: ${report.passed}/${report.totalTests} passed`,
        );
      }
    } catch (err) {
      this.logger.error(`Unexpected error: ${err.message}`, err.stack);
      client.emit("error", { message: `Unexpected error: ${err.message}` });
    } finally {
      this.runningJobs.delete(jobId);
    }
  }

  @SubscribeMessage("cancel-tests")
  handleCancelTests(@ConnectedSocket() client: Socket) {
    this.runningJobs.set(client.id, false);
    client.emit("status", {
      phase: "cancelled",
      message: "Cancelling test run...",
    });
  }

  @SubscribeMessage("dry-run")
  async handleDryRun(
    @MessageBody() dto: RunTestsDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      client.emit("status", {
        phase: "parsing",
        message: "🔍 Fetching spec for dry run...",
      });

      const spec = await this.swaggerParser.parseSwaggerUrl(
        dto.swaggerUrl,
        dto.baseUrl,
      );
      const hasAuth = dto.authType !== AuthType.NONE;
      const profile = dto.runProfile ?? 'full';
      let testPlans = await this.testGenerator.generateAllTests(
        spec,
        hasAuth,
        profile === 'smoke' || !!dto.skipAiGeneration,
      );
      testPlans = this.runOrchestrator.applyRunProfile(testPlans, profile);

      const totalTests = this.testGenerator.countTotalTests(testPlans);
      const aiTestCount = testPlans.reduce(
        (sum, plan) =>
          sum +
          plan.tests.filter(
            (t) =>
              !t.isSkipped &&
              (t.category === 'ai-edge-case' || t.testName.startsWith('[AI]')),
          ).length,
        0,
      );

      client.emit("dry-run-result", {
        title: spec.title,
        baseUrl: dto.baseUrl || spec.baseUrl,
        endpointCount: spec.endpoints.length,
        totalTests,
        aiTestCount,
        runProfile: profile,
        breakdown: testPlans.map((p) => ({
          endpoint: `${p.method} ${p.endpoint}`,
          testCount: p.tests.filter((t) => !t.isSkipped).length,
          skipped: p.skipped,
          skipReason: p.skipReason,
        })),
      });
    } catch (err) {
      client.emit("error", { message: `Dry run failed: ${err.message}` });
    }
  }

  @SubscribeMessage("request-ai-insights")
  async handleRequestAiInsights(
    @MessageBody() report: any,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`Client ${client.id} requested AI report insights`);
      const insights = await this.testGenerator.getGeminiService().analyzeReport(report);
      client.emit("ai-insights-result", { insights });
    } catch (err) {
      client.emit("ai-insights-result", { insights: `### ⚠️ Error\nFailed to generate AI insights: ${err.message}` });
    }
  }

  @SubscribeMessage("request-root-cause")
  async handleRequestRootCause(
    @MessageBody() data: { testKey: string; result: any },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`Client ${client.id} requested diagnostics for: ${data.testKey}`);
      const diagnostic = await this.failureDiagnostics.analyze(data.result, true);
      const analysis = `### Root Cause\n${diagnostic.likelyCause}\n\n**Owner:** ${diagnostic.ownerHint} | **Severity:** ${diagnostic.severity} | **Source:** ${diagnostic.source}\n\n### Recommended Fix\n${diagnostic.suggestedFix}`;
      client.emit("root-cause-result", { testKey: data.testKey, analysis, diagnostic });
    } catch (err) {
      const rules = this.failureDiagnostics.analyzeWithRules(data.result);
      const analysis = `### Root Cause\n${rules.likelyCause}\n\n### Recommended Fix\n${rules.suggestedFix}`;
      client.emit("root-cause-result", { testKey: data.testKey, analysis, diagnostic: rules });
    }
  }
}
