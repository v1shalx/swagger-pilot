/**
 * @file test-events.gateway.ts
 * @description Socket.IO WebSocket gateway - the real-time bridge between the
 * React frontend and the NestJS audit engine.
 *
 * Socket events (client to server):
 *  - run-tests           -> Start a full audit run with a RunTestsDto payload
 *  - cancel-tests        -> Abort the in-progress run for this client
 *  - request-ai-insights -> Generate an AI executive summary for a completed report
 *  - request-root-cause  -> Run structured failure diagnostics on a single test
 *
 * Socket events (server to client):
 *  - connected           -> Handshake with geminiConfigured flag
 *  - status              -> Phase transitions and live spec metadata
 *  - warning             -> Non-fatal advisory messages
 *  - test-result         -> One event per executed test
 *  - complete            -> Final report once the run finishes
 *  - error               -> Unrecoverable error during the run
 *  - ai-insights-result  -> Gemini executive summary markdown
 *  - root-cause-result   -> Structured diagnostic for a failed test
 */

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
import { TestGeneratorService } from '../test-generator/test-generator.service';
import { RunTestsDto } from '../swagger-parser/swagger-parser.dto';
import { RunOrchestratorService } from '../run-orchestrator/run-orchestrator.service';
import { FailureDiagnosticsService } from '../diagnostics/failure-diagnostics.service';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/' })
export class TestEventsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  /**
   * Tracks active jobs by client socket ID.
   * Set to false to signal cancellation; deleted on disconnect or completion.
   */
  private runningJobs = new Map<string, boolean>();

  private readonly logger = new Logger(TestEventsGateway.name);

  constructor(
    private readonly testGenerator: TestGeneratorService,
    private readonly runOrchestrator: RunOrchestratorService,
    private readonly failureDiagnostics: FailureDiagnosticsService,
  ) {}

  /** Send initial handshake including Gemini availability flag. */
  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    client.emit('connected', {
      message: 'SwaggerPilot ready',
      geminiConfigured: this.testGenerator.getGeminiService().isConfigured(),
    });
  }

  /** Clean up the job entry so cancelled runs do not leak. */
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.runningJobs.delete(client.id);
  }

  /**
   * Start a full audit run.
   *
   * Delegates to RunOrchestratorService.executeRun and streams
   * status, warning, and test-result events back in real time.
   * Emits complete with the final report, or error on failure.
   */
  @SubscribeMessage('run-tests')
  async handleRunTests(
    @MessageBody() dto: RunTestsDto,
    @ConnectedSocket() client: Socket,
  ) {
    const jobId = client.id;
    this.runningJobs.set(jobId, true);

    try {
      const report = await this.runOrchestrator.executeRun(dto, {
        onStatus:       (data) => client.emit('status', data),
        onWarning:      (data) => client.emit('warning', { message: data }),
        onTestResult:   (result) => client.emit('test-result', result),
        shouldContinue: () => this.runningJobs.get(jobId) === true,
      });

      if (this.runningJobs.get(jobId)) {
        client.emit('complete', { report });
        this.logger.log(
          `Run complete for ${client.id}: ${report.passed}/${report.totalTests} passed`,
        );
      }
    } catch (err) {
      this.logger.error(`Unexpected error: ${err.message}`, err.stack);
      client.emit('error', { message: `Unexpected error: ${err.message}` });
    } finally {
      this.runningJobs.delete(jobId);
    }
  }

  /**
   * Signal the orchestrator to stop after the current batch finishes.
   * The shouldContinue callback in handleRunTests will return false
   * on the next check, gracefully halting execution.
   */
  @SubscribeMessage('cancel-tests')
  handleCancelTests(@ConnectedSocket() client: Socket) {
    this.runningJobs.set(client.id, false);
    client.emit('status', { phase: 'cancelled', message: 'Cancelling...' });
  }

  /**
   * Generate a Gemini AI executive summary for a completed report.
   * Fires ai-insights-result with the markdown string when done.
   */
  @SubscribeMessage('request-ai-insights')
  async handleRequestAiInsights(
    @MessageBody() report: any,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`AI insights requested by ${client.id}`);
      const insights = await this.testGenerator.getGeminiService().analyzeReport(report);
      client.emit('ai-insights-result', { insights });
    } catch (err) {
      client.emit('ai-insights-result', {
        insights: `### Error\nFailed to generate AI insights: ${err.message}`,
      });
    }
  }

  /**
   * Run structured root-cause analysis for a single failed test.
   *
   * Tries Gemini first via FailureDiagnosticsService.analyze; falls
   * back to rule-based analysis if Gemini is unavailable or throws.
   * Fires root-cause-result with the diagnostic object.
   */
  @SubscribeMessage('request-root-cause')
  async handleRequestRootCause(
    @MessageBody() data: { testKey: string; result: any },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`Root-cause requested for: ${data.testKey}`);
      const diagnostic = await this.failureDiagnostics.analyze(data.result, true);
      const ownerLine = `**Owner:** ${diagnostic.ownerHint} | **Severity:** ${diagnostic.severity} | **Source:** ${diagnostic.source}`;
      const analysis = `### Root Cause\n${diagnostic.likelyCause}\n\n${ownerLine}\n\n### Recommended Fix\n${diagnostic.suggestedFix}`;
      client.emit('root-cause-result', { testKey: data.testKey, analysis, diagnostic });
    } catch (err) {
      // Rule-based fallback - always available, no API key needed
      const rules = this.failureDiagnostics.analyzeWithRules(data.result);
      const analysis = `### Root Cause\n${rules.likelyCause}\n\n### Recommended Fix\n${rules.suggestedFix}`;
      client.emit('root-cause-result', { testKey: data.testKey, analysis, diagnostic: rules });
    }
  }
}
