import { Module } from '@nestjs/common';
import { SwaggerParserModule } from './swagger-parser/swagger-parser.module';
import { TestGeneratorModule } from './test-generator/test-generator.module';
import { TestRunnerModule } from './test-runner/test-runner.module';
import { ReporterModule } from './reporter/reporter.module';
import { GatewayModule } from './gateway/gateway.module';
import { RunOrchestratorModule } from './run-orchestrator/run-orchestrator.module';
import { HealthModule } from './health/health.module';
import { DiagnosticsModule } from './diagnostics/diagnostics.module';

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
  ],
})
export class AppModule {}
