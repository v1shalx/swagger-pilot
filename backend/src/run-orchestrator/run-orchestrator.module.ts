import { Module } from '@nestjs/common';
import { RunOrchestratorService } from './run-orchestrator.service';
import { SwaggerParserModule } from '../swagger-parser/swagger-parser.module';
import { TestGeneratorModule } from '../test-generator/test-generator.module';
import { TestRunnerModule } from '../test-runner/test-runner.module';
import { ReporterModule } from '../reporter/reporter.module';
import { SecurityModule } from '../security/security.module';

/**
 * Assembles all services required to execute a full API audit run
 * from spec parsing through to report assembly and security scanning.
 */
@Module({
  imports: [
    SwaggerParserModule,
    TestGeneratorModule,
    TestRunnerModule,
    ReporterModule,
    SecurityModule,
  ],
  providers: [RunOrchestratorService],
  exports:   [RunOrchestratorService],
})
export class RunOrchestratorModule {}
