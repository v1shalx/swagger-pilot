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
import { TestRunnerService } from '../test-runner/test-runner.service';
import { AuthHandlerService } from '../test-runner/auth-handler.service';
import { ReporterService } from '../reporter/reporter.service';
import { RunTestsDto, AuthType } from '../swagger-parser/swagger-parser.dto';
import { CustomTestParserService } from "../custom-test-parser/custom-test-parser.service";

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
    private readonly testRunner: TestRunnerService,
    private readonly authHandler: AuthHandlerService,
    private readonly reporter: ReporterService,
    private readonly customTestParser: CustomTestParserService, 
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    client.emit("connected", { message: "SwaggerPilot ready" });
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
    const startedAt = new Date();

    try {
      // Emit: starting
      client.emit("status", {
        phase: "parsing",
        message: "🔍 Fetching and parsing Swagger spec...",
      });

      // Step 1: Parse swagger
      let spec: any;

      // Manual only mode — skip swagger parsing
      if (dto.swaggerUrl === "__manual_only__") {
        spec = {
          title: "Manual Tests",
          version: "1.0",
          baseUrl: dto.baseUrl,
          securitySchemes: {},
          endpoints: [],
          openApiVersion: "3.0",
        };
      } else {
        try {
          spec = await this.swaggerParser.parseSwaggerUrl(
            dto.swaggerUrl,
            dto.baseUrl,
          );
        } catch (err) {
          client.emit("error", {
            message: `Failed to parse Swagger: ${err.message}`,
          });
          return;
        }
      }

      const baseUrl = dto.baseUrl || spec.baseUrl;

      client.emit("status", {
        phase: "parsed",
        message: `✅ Parsed spec: "${spec.title}" — ${spec.endpoints.length} endpoints found`,
        spec: {
          title: spec.title,
          version: spec.version,
          baseUrl,
          endpointCount: spec.endpoints.length,
          openApiVersion: spec.openApiVersion,
        },
      });

      // Warn if localhost URL detected and this seems to be a remote client
      if (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) {
        client.emit("warning", {
          message:
            "⚠️ Localhost URL detected. Make sure SwaggerPilot backend is running on the same machine as your API.",
        });
      }

      // Step 2: Resolve auth
      this.authHandler.clearCache();
      const authHeaders = await this.authHandler.resolveAuthHeaders(dto);
      const authQueryParams = this.authHandler.resolveAuthQueryParams(dto);
      const hasAuth = dto.authType !== AuthType.NONE;

      client.emit("status", {
        phase: "generating",
        message: "⚙️ Generating test cases...",
      });

      // Step 3: Generate tests
      // Step 3: Generate tests
      const testPlans = await this.testGenerator.generateAllTests(
        spec,
        hasAuth,
        dto.skipAiGeneration,
      );

      // Inject custom tests BEFORE counting and running
      if ((dto as any).customTests && (dto as any).customTestsType) {
        try {
          const customTests = this.customTestParser.parseFileContent(
            (dto as any).customTests,
            (dto as any).customTestsType,
          );
          testPlans.push({
            endpoint: "custom-uploaded",
            method: "MIXED",
            summary: "Manual tester uploaded test cases",
            tests: customTests,
            skipped: false,
          });
        } catch (err) {
          client.emit("warning", {
            message: `⚠️ Custom test file error: ${err.message}`,
          });
        }
      }

      const totalTests = this.testGenerator.countTotalTests(testPlans);

      client.emit("status", {
        phase: "ready",
        message: `🧪 ${totalTests} tests ready. Running now...`,
        totalTests,
      });

      // Step 4: Run tests
      this.testRunner.resetState();
      const allResults: any[] = [];
      let completedCount = 0;

      for (const plan of testPlans) {
        if (!this.runningJobs.get(jobId)) {
          client.emit("status", {
            phase: "cancelled",
            message: "Test run cancelled",
          });
          return;
        }

        for (const test of plan.tests) {
          if (!this.runningJobs.get(jobId)) break;

          const result = await this.testRunner.runTest(
            test,
            baseUrl,
            dto,
            authHeaders,
            authQueryParams,
            (r) => {
              allResults.push(r);
              completedCount++;
              client.emit("test-result", {
                ...r,
                progress: { completed: completedCount, total: totalTests },
              });
            },
          );

          // Rate limiting - delay between tests
          const delay = dto.delayBetweenTests || 100;
          await this.sleep(delay);
        }
      }

      // Step 5: Generate report
      const report = this.reporter.generateReport(
        allResults,
        dto.swaggerUrl,
        baseUrl,
        spec.title,
        startedAt,
        this.testRunner.wasTokenExpiryDetected(),
      );

      client.emit("complete", { report });
      this.logger.log(
        `Test run complete for ${client.id}: ${report.passed}/${report.totalTests} passed`,
      );
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
      const testPlans = await this.testGenerator.generateAllTests(
        spec,
        hasAuth,
        true,
      );
      const totalTests = this.testGenerator.countTotalTests(testPlans);

      client.emit("dry-run-result", {
        title: spec.title,
        baseUrl: dto.baseUrl || spec.baseUrl,
        endpointCount: spec.endpoints.length,
        totalTests,
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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
