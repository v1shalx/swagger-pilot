/**
 * @file gateway.module.ts
 * @description NestJS module that wires up the WebSocket gateway.
 *
 * The gateway only needs TestGenerator (for Gemini flag check),
 * RunOrchestrator (for audit execution), and Diagnostics (for root-cause
 * analysis). All other modules are already imported by RunOrchestratorModule
 * transitively and do not need to be repeated here.
 */

import { Module } from '@nestjs/common';
import { TestEventsGateway } from './test-events.gateway';
import { TestGeneratorModule } from '../test-generator/test-generator.module';
import { RunOrchestratorModule } from '../run-orchestrator/run-orchestrator.module';
import { DiagnosticsModule } from '../diagnostics/diagnostics.module';

@Module({
  imports: [
    TestGeneratorModule,
    RunOrchestratorModule,
    DiagnosticsModule,
  ],
  providers: [TestEventsGateway],
})
export class GatewayModule {}
