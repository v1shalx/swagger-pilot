import { Module } from '@nestjs/common';
import { FailureDiagnosticsService } from './failure-diagnostics.service';
import { TestGeneratorModule } from '../test-generator/test-generator.module';

@Module({
  imports: [TestGeneratorModule],
  providers: [FailureDiagnosticsService],
  exports: [FailureDiagnosticsService],
})
export class DiagnosticsModule {}
