import { Module } from '@nestjs/common';
import { ReporterService } from './reporter.service';
import { ContractDriftService } from './contract-drift.service';
import { RegressionService } from './regression.service';
import { FlakinessService } from './flakiness.service';
import { SchemaDiffService } from './schema-diff.service';
import { DiagnosticsModule } from '../diagnostics/diagnostics.module';

/**
 * Groups all post-run analysis and reporting services.
 * Exported: ReporterService, RegressionService, FlakinessService, SchemaDiffService
 */
@Module({
  imports: [DiagnosticsModule],
  providers: [
    ReporterService,
    ContractDriftService,
    RegressionService,
    FlakinessService,
    SchemaDiffService,
  ],
  exports: [
    ReporterService,
    RegressionService,
    FlakinessService,
    SchemaDiffService,
  ],
})
export class ReporterModule {}
