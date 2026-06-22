import { Module } from '@nestjs/common';
import { ReporterService } from './reporter.service';
import { ContractDriftService } from './contract-drift.service';
import { RegressionService } from './regression.service';
import { DiagnosticsModule } from '../diagnostics/diagnostics.module';

@Module({
  imports: [DiagnosticsModule],
  providers: [ReporterService, ContractDriftService, RegressionService],
  exports: [ReporterService, RegressionService],
})
export class ReporterModule {}
