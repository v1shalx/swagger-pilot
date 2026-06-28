/**
 * @file reporter.service.ts
 * @description Assembles the final {@link TestReport} from raw {@link TestResult}s.
 *
 * Responsibilities:
 *  1. Aggregate pass / fail / error / skip counts and compute pass rate.
 *  2. Build per-endpoint and per-category breakdowns for the dashboard charts.
 *  3. Delegate contract-drift analysis to {@link ContractDriftService}.
 *  4. Compute spec coverage — endpoints tested vs. endpoints documented.
 *  5. Compute release readiness (go / warn / no-go) with blocking IDOR escalation.
 *  6. Attach rule-based failure diagnostics for the top 8 failures.
 */

import { Injectable } from '@nestjs/common';
import { TestResult } from '../test-runner/test-runner.service';
import { ParsedEndpoint } from '../swagger-parser/swagger-parser.dto';
import { ContractDriftService, ContractDriftReport } from './contract-drift.service';
import { FailureDiagnosticsService, FailureDiagnostic } from '../diagnostics/failure-diagnostics.service';
import { FlakinessSummary } from './flakiness.service';

export interface SpecCoverage {
  endpointsTested: number;
  endpointsInSpec: number;
  endpointCoveragePercent: number;
  statusCodesTested: number;
  statusCodesDocumented: number;
  statusCodeCoveragePercent: number;
  headline: string;
}

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
  specCoverage?: SpecCoverage;
  topFailureInsights?: { testKey: string; diagnostic: FailureDiagnostic }[];
  /**
   * Populated when the orchestrator runs a flakiness re-check after the main run.
   * Only present when at least one failure was re-run.
   */
  flakiness?: FlakinessSummary;
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

  /**
   * Build the full {@link TestReport} for a completed audit run.
   *
   * @param results           - All test results (pass, fail, error, skipped).
   * @param swaggerUrl        - The spec URL that was audited.
   * @param baseUrl           - The API host that was tested against.
   * @param title             - API title from the spec (e.g. "Petstore v3").
   * @param startedAt         - Timestamp when execution began.
   * @param tokenExpiryWarning - True when the runner detected a mid-run 401.
   * @param specEndpoints     - Parsed endpoints from the spec, used for coverage.
   */
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

    // IDOR / authorization leaks → always no-go
    const idorLeaks = results.filter(
      (r) => r.category === 'authorization_leak' && r.status === 'FAIL',
    );

    const releaseReadiness = this.computeReleaseReadiness(
      passRate,
      failed,
      errors,
      contractDrift,
      idorLeaks.length,
    );

    // ── Feature 5: Spec coverage ─────────────────────────────────────────────
    const specCoverage = this.computeSpecCoverage(specEndpoints, results);

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
      specCoverage,
      topFailureInsights,
    };
  }

  /**
   * Compute endpoint and status-code coverage against the OpenAPI spec.
   *
   * Only endpoints that appear in the spec are counted — chain/IDOR test calls
   * target extra paths that inflate the tested set, so we filter them out with
   * a Set lookup before computing the percentage.
   *
   * @returns `undefined` when no spec endpoints were provided (e.g. manual-only run).
   */
  private computeSpecCoverage(specEndpoints: any[], results: TestResult[]): SpecCoverage | undefined {
    if (specEndpoints.length === 0) return undefined;

    const testedKeys = new Set(
      results
        .filter((r) => r.status !== 'SKIPPED')
        .map((r) => `${r.method} ${r.path}`),
    );
    // Only count endpoints that are actually in the spec (chain/IDOR tests can exceed spec count)
    const specKeys = new Set(specEndpoints.map((e) => `${e.method.toUpperCase()} ${e.path}`));
    const endpointsTested = [...testedKeys].filter((k) => specKeys.has(k)).length;
    const endpointsInSpec = specEndpoints.length;
    const endpointCoverage = endpointsInSpec > 0
      ? Math.min(100, Math.round((endpointsTested / endpointsInSpec) * 100))
      : 0;

    // Count documented status codes vs exercised
    let statusCodesDocumented = 0;
    let statusCodesTested = 0;

    for (const ep of specEndpoints) {
      const docCodes = Object.keys(ep.responses || {})
        .filter((k) => /^\d{3}$/.test(k))
        .map(Number);
      statusCodesDocumented += docCodes.length;

      const exercised = new Set(
        results
          .filter((r) => r.method === ep.method && r.path === ep.path && r.actual !== null)
          .map((r) => r.actual!),
      );
      statusCodesTested += docCodes.filter((c) => exercised.has(c)).length;
    }

    const statusCodeCoveragePercent = statusCodesDocumented > 0
      ? Math.round((statusCodesTested / statusCodesDocumented) * 100)
      : 0;

    return {
      endpointsTested,
      endpointsInSpec,
      endpointCoveragePercent: endpointCoverage,
      statusCodesTested,
      statusCodesDocumented,
      statusCodeCoveragePercent,
      headline: `Spec coverage: ${endpointCoverage}% endpoints, ${statusCodeCoveragePercent}% status codes`,
    };
  }

  /**
   * Determine the release-readiness verdict based on test outcomes.
   *
   * Decision matrix:
   *  - Any IDOR leak → always `no-go` (security vulnerability is blocking).
   *  - Pass rate ≥ 85% and no drift → `go`.
   *  - Pass rate ≥ 70% and no critical drift → `warn`.
   *  - Everything else → `no-go`.
   *
   * @param idorLeaks - Count of failed `authorization_leak` tests.
   */
  private computeReleaseReadiness(
    passRate: number,
    failed: number,
    errors: number,
    drift?: ContractDriftReport,
    idorLeaks = 0,
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
    if (idorLeaks > 0) {
      reasons.push(`🚨 ${idorLeaks} Broken Object Level Authorization (IDOR) vulnerability/ies detected — immediate fix required`);
    }

    // IDOR leaks are always blocking
    if (idorLeaks > 0) {
      return { status: 'no-go', label: 'NOT RELEASE READY — SECURITY VULNERABILITY', reasons };
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
