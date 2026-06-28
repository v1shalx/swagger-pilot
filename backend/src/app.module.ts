/**
 * @file app.module.ts
 * @description Root NestJS module — imports all feature modules.
 *
 * Module responsibilities:
 *  - SwaggerParserModule   → fetch + parse OpenAPI / Swagger specs
 *  - TestGeneratorModule   → rule engine + Gemini AI edge-case generation
 *  - TestRunnerModule      → HTTP test execution + auth handling
 *  - ReporterModule        → report assembly, spec coverage, flakiness
 *  - RunOrchestratorModule → coordinates the full run lifecycle
 *  - GatewayModule         → WebSocket gateway (Socket.IO)
 *  - HealthModule          → GET /health for load-balancer probes
 *  - DiagnosticsModule     → rule-based failure analysis
 *  - MonitoringModule      → cron-based API health checks + Slack alerts
 */

import { Module } from '@nestjs/common';
import { SwaggerParserModule } from './swagger-parser/swagger-parser.module';
import { TestGeneratorModule } from './test-generator/test-generator.module';
import { TestRunnerModule } from './test-runner/test-runner.module';
import { ReporterModule } from './reporter/reporter.module';
import { GatewayModule } from './gateway/gateway.module';
import { RunOrchestratorModule } from './run-orchestrator/run-orchestrator.module';
import { HealthModule } from './health/health.module';
import { DiagnosticsModule } from './diagnostics/diagnostics.module';
import { MonitoringModule } from './monitoring/monitoring.module';

@Module({
  imports: [
    SwaggerParserModule,
    TestGeneratorModule,
    TestRunnerModule,
    ReporterModule,
    RunOrchestratorModule,
    GatewayModule,
    HealthModule,
    DiagnosticsModule,
    MonitoringModule,
  ],
})
export class AppModule {}
