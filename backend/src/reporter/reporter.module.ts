import { Module } from '@nestjs/common';
import { ReporterService } from './reporter.service';
import { ContractDriftService } from './contract-drift.service';
import { DiagnosticsModule } from '../diagnostics/diagnostics.module';

@Module({
  imports: [DiagnosticsModule],
  providers: [ReporterService, ContractDriftService],
  exports: [ReporterService],
})
export class ReporterModule {}
