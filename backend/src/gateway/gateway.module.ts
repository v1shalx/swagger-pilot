import { Module } from '@nestjs/common';
import { TestEventsGateway } from './test-events.gateway';
import { SwaggerParserModule } from '../swagger-parser/swagger-parser.module';
import { TestGeneratorModule } from '../test-generator/test-generator.module';
import { TestRunnerModule } from '../test-runner/test-runner.module';
import { ReporterModule } from '../reporter/reporter.module';

@Module({
  imports: [SwaggerParserModule, TestGeneratorModule, TestRunnerModule, ReporterModule],
  providers: [TestEventsGateway],
})
export class GatewayModule {}
