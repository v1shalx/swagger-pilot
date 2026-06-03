import { Module } from '@nestjs/common';
import { RunOrchestratorService } from './run-orchestrator.service';
import { SwaggerParserModule } from '../swagger-parser/swagger-parser.module';
import { TestGeneratorModule } from '../test-generator/test-generator.module';
import { TestRunnerModule } from '../test-runner/test-runner.module';
import { ReporterModule } from '../reporter/reporter.module';
import { CustomTestParserModule } from '../custom-test-parser/custom-test-parser.module';

@Module({
  imports: [
    SwaggerParserModule,
    TestGeneratorModule,
    TestRunnerModule,
    ReporterModule,
    CustomTestParserModule,
  ],
  providers: [RunOrchestratorService],
  exports: [RunOrchestratorService],
})
export class RunOrchestratorModule {}
