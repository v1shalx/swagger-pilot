import { Injectable } from '@nestjs/common';
import { TestResult } from '../test-runner/test-runner.service';
import { ParsedEndpoint } from '../swagger-parser/swagger-parser.dto';
import { ContractDriftService, ContractDriftReport } from './contract-drift.service';
import { FailureDiagnosticsService, FailureDiagnostic } from '../diagnostics/failure-diagnostics.service';

export interface TestReport {
  title: string;
  swaggerUrl: string;
  baseUrl: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  totalTests: number;
  passed: number;
  failed: number;
  errors: number;
  skipped: number;
  passRate: number;
  tokenExpiryWarning: boolean;
  byEndpoint: EndpointSummary[];
  byCategory: CategorySummary[];
  failedTests: TestResult[];
  allTests: TestResult[];
  contractDrift?: ContractDriftReport;
  releaseReadiness?: ReleaseReadiness;
  estimatedManualHoursSaved?: number;
  topFailureInsights?: { testKey: string; diagnostic: FailureDiagnostic }[];
}

export interface ReleaseReadiness {
  status: 'go' | 'warn' | 'no-go';
  label: string;
  reasons: string[];
}

export interface EndpointSummary {
  endpoint: string;
  method: string;
  total: number;
  passed: number;
  failed: number;
  errors: number;
  skipped: number;
}

export interface CategorySummary {
  category: string;
  total: number;
  passed: number;
  failed: number;
}

@Injectable()
export class ReporterService {
  constructor(
    private readonly contractDrift: ContractDriftService,
    private readonly failureDiagnostics: FailureDiagnosticsService,
  ) {}

  generateReport(
    results: TestResult[],
    swaggerUrl: string,
    baseUrl: string,
    title: string,
    startedAt: Date,
    tokenExpiryWarning: boolean,
    specEndpoints: ParsedEndpoint[] = [],
  ): TestReport {
    const completedAt = new Date();
    const nonSkipped = results.filter((r) => r.status !== 'SKIPPED');

    const passed = results.filter((r) => r.status === 'PASS').length;
    const failed = results.filter((r) => r.status === 'FAIL').length;
    const errors = results.filter((r) => r.status === 'ERROR').length;
    const skipped = results.filter((r) => r.status === 'SKIPPED').length;
    const total = nonSkipped.length;

    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    const endpointMap = new Map<string, EndpointSummary>();
    for (const r of results) {
      const key = `${r.method} ${r.path}`;
      if (!endpointMap.has(key)) {
        endpointMap.set(key, {
          endpoint: r.path,
          method: r.method,
          total: 0,
          passed: 0,
          failed: 0,
          errors: 0,
          skipped: 0,
        });
      }
      const s = endpointMap.get(key)!;
      s.total++;
      if (r.status === 'PASS') s.passed++;
      else if (r.status === 'FAIL') s.failed++;
      else if (r.status === 'ERROR') s.errors++;
      else if (r.status === 'SKIPPED') s.skipped++;
    }

    const categoryMap = new Map<string, CategorySummary>();
    for (const r of results.filter((r) => r.status !== 'SKIPPED')) {
      const key = r.category;
      if (!categoryMap.has(key)) {
        categoryMap.set(key, { category: key, total: 0, passed: 0, failed: 0 });
      }
      const c = categoryMap.get(key)!;
      c.total++;
      if (r.status === 'PASS') c.passed++;
      else c.failed++;
    }

    const contractDrift =
      specEndpoints.length > 0
        ? this.contractDrift.analyze(specEndpoints, results)
        : undefined;

    const releaseReadiness = this.computeReleaseReadiness(
      passRate,
      failed,
      errors,
      contractDrift,
    );

    const failedTests = results.filter((r) => r.status === 'FAIL' || r.status === 'ERROR');
    const topFailureInsights = failedTests.slice(0, 8).map((t) => ({
      testKey: `${t.method}-${t.path}-${t.testName}`,
      diagnostic: this.failureDiagnostics.analyzeWithRules(t),
    }));

    return {
      title,
      swaggerUrl,
      baseUrl,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      totalTests: total,
      passed,
      failed,
      errors,
      skipped,
      passRate,
      tokenExpiryWarning,
      byEndpoint: Array.from(endpointMap.values()),
      byCategory: Array.from(categoryMap.values()),
      failedTests,
      allTests: results,
      contractDrift,
      releaseReadiness,
      estimatedManualHoursSaved: Math.round((total * 2) / 6) / 10,
      topFailureInsights,
    };
  }

  private computeReleaseReadiness(
    passRate: number,
    failed: number,
    errors: number,
    drift?: ContractDriftReport,
  ): ReleaseReadiness {
    const reasons: string[] = [];
    const criticalDrift =
      drift?.items.filter((i) => i.severity === 'critical').length ?? 0;

    if (passRate < 60) reasons.push(`Pass rate is ${passRate}% (below 60%)`);
    if (failed + errors > 0) reasons.push(`${failed + errors} failing tests need fixes`);
    if (criticalDrift > 0) {
      reasons.push(`${criticalDrift} critical OpenAPI contract drift issue(s)`);
    }
    if (drift && drift.endpointsTested < drift.endpointsInSpec * 0.5) {
      reasons.push('Less than half of spec endpoints were tested');
    }

    if (reasons.length === 0 && passRate >= 85) {
      return { status: 'go', label: 'Release Ready', reasons: ['Pass rate and contract alignment look good'] };
    }
    if (passRate >= 70 && criticalDrift === 0) {
      return { status: 'warn', label: 'Review Recommended', reasons };
    }
    return { status: 'no-go', label: 'Not Release Ready', reasons: reasons.length ? reasons : ['Audit found blocking issues'] };
  }
}
