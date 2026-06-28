/**
 * @file run-orchestrator.service.ts
 * @description Coordinates the full test-run lifecycle from spec parsing to report assembly.
 *
 * Execution order:
 *  1. Parse the Swagger / OpenAPI spec via {@link SwaggerParserService}
 *  2. Generate test cases via {@link TestGeneratorService} (rule engine + optional Gemini AI)
 *  3. Apply the selected run profile (smoke filters to auth + happy-path only)
 *  4. Execute tests concurrently via {@link TestRunnerService}
 *  5. Run chain tests (POST → GET → DELETE) via {@link ChainRunnerService}
 *  6. Run IDOR checks via {@link IdorCheckerService} (if enabled by the user)
 *  7. Run flakiness re-check on failures via {@link FlakinessService}
 *  8. Assemble the final {@link TestReport} via {@link ReporterService}
 *  9. Optionally compare to a regression baseline via {@link RegressionService}
 */

import { Injectable, Logger } from '@nestjs/common';
import { SwaggerParserService } from '../swagger-parser/swagger-parser.service';
import { TestGeneratorService, EndpointTestPlan } from '../test-generator/test-generator.service';
import { TestRunnerService, TestResult } from '../test-runner/test-runner.service';
import { AuthHandlerService } from '../test-runner/auth-handler.service';
import { ChainRunnerService } from '../test-runner/chain-runner.service';
import { IdorCheckerService } from '../test-runner/idor-checker.service';
import { RegressionService } from '../reporter/regression.service';
import { ReporterService, TestReport } from '../reporter/reporter.service';
import { FlakinessService } from '../reporter/flakiness.service';
import { SchemaDiffService } from '../reporter/schema-diff.service';
import { SecurityProbeService } from '../security/security-probe.service';
import { RunTestsDto, AuthType } from '../swagger-parser/swagger-parser.dto';
import { GeneratedTest } from '../test-generator/rule-engine.service';

export type RunProfile = 'smoke' | 'full';

/** Categories included in a smoke run — fast sanity check before a full audit. */
const SMOKE_CATEGORIES = new Set(['auth', 'happy-path']);

export interface RunProgressCallbacks {
  /** Fires on major phase transitions (parsing, generating, running, etc.). */
  onStatus?: (data: { phase: string; message: string; totalTests?: number; spec?: unknown }) => void;
  /** Fires for non-fatal advisory messages (e.g. localhost URL detected). */
  onWarning?: (message: string) => void;
  /** Fires once per completed test so the UI can update live. */
  onTestResult?: (result: TestResult & { progress?: { completed: number; total: number } }) => void;
  /** Return `false` to abort the run after the current batch finishes. */
  shouldContinue?: () => boolean;
}

@Injectable()
export class RunOrchestratorService {
  private readonly logger = new Logger(RunOrchestratorService.name);

  constructor(
    private readonly swaggerParser: SwaggerParserService,
    private readonly testGenerator: TestGeneratorService,
    private readonly testRunner: TestRunnerService,
    private readonly authHandler: AuthHandlerService,
    private readonly chainRunner: ChainRunnerService,
    private readonly idorChecker: IdorCheckerService,
    private readonly regression: RegressionService,
    private readonly reporter: ReporterService,
    private readonly flakiness: FlakinessService,
    private readonly schemaDiff: SchemaDiffService,
    private readonly security: SecurityProbeService,
  ) {}

  /**
   * Filter test plans to include only the categories applicable to the chosen profile.
   *
   * - `smoke`  → auth + happy-path only (plus already-skipped tests)
   * - `full`   → all categories unchanged
   *
   * @param plans   - All generated endpoint plans from {@link TestGeneratorService}
   * @param profile - The run profile selected by the user
   * @returns Filtered plans (original array reference returned for `full`)
   */
  applyRunProfile(plans: EndpointTestPlan[], profile?: RunProfile): EndpointTestPlan[] {
    if (profile !== 'smoke') return plans;
    return plans.map((plan) => ({
      ...plan,
      tests: plan.tests.filter(
        (t) => t.isSkipped || SMOKE_CATEGORIES.has(t.category),
      ),
    }));
  }

  /**
   * Execute a full audit run end-to-end, streaming progress via callbacks.
   *
   * The orchestrator intentionally owns no business logic — each major step
   * is delegated to its respective service. The callbacks let the WebSocket
   * gateway forward real-time events to the React frontend as they happen.
   *
   * @param dto       - Full configuration payload from the frontend
   * @param callbacks - Optional real-time event hooks for streaming progress
   * @returns         The fully assembled {@link TestReport}
   */
  async executeRun(dto: RunTestsDto, callbacks: RunProgressCallbacks = {}): Promise<TestReport> {
    const startedAt = new Date();
    const profile = dto.runProfile ?? 'full';
    const skipAi = profile === 'smoke' || !!dto.skipAiGeneration;
    const concurrency = Math.min(Math.max(dto.maxConcurrent ?? 3, 1), 8);

    // ── Step 1: Parse the OpenAPI / Swagger spec ─────────────────────────────
    callbacks.onStatus?.({ phase: 'parsing', message: 'Fetching and parsing Swagger spec...' });
    const spec = await this.swaggerParser.parseSwaggerUrl(dto.swaggerUrl, dto.baseUrl);
    const baseUrl = dto.baseUrl || spec.baseUrl;

    // Narrow to user-selected endpoints only (Feature 1: Endpoint Selector)
    if (dto.selectedEndpoints && dto.selectedEndpoints.length > 0) {
      const selected = new Set(dto.selectedEndpoints.map((s) => s.trim().toUpperCase()));
      spec.endpoints = spec.endpoints.filter((ep) =>
        selected.has(`${ep.method.toUpperCase()} ${ep.path}`),
      );
    }

    callbacks.onStatus?.({
      phase: 'parsed',
      message: `Parsed "${spec.title}" — ${spec.endpoints.length} endpoints`,
      spec: {
        title: spec.title,
        version: spec.version,
        baseUrl,
        endpointCount: spec.endpoints.length,
        openApiVersion: spec.openApiVersion,
        allEndpoints: spec.endpoints.map((e) => `${e.method} ${e.path}`),
      },
    });

    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      callbacks.onWarning?.(
        'Localhost URL detected. Run SwaggerPilot on the same machine as your API.',
      );
    }

    // ── Step 2: Resolve authentication ───────────────────────────────────────
    this.authHandler.clearCache();
    const authHeaders = await this.authHandler.resolveAuthHeaders(dto);
    const authQueryParams = this.authHandler.resolveAuthQueryParams(dto);
    const hasAuth = dto.authType !== AuthType.NONE;

    // ── Step 3: Generate test cases ──────────────────────────────────────────
    callbacks.onStatus?.({
      phase: 'generating',
      message: profile === 'smoke'
        ? 'Generating smoke tests (auth + happy path)...'
        : 'Generating test cases...',
    });

    let testPlans = await this.testGenerator.generateAllTests(spec, hasAuth, skipAi);
    testPlans = this.applyRunProfile(testPlans, profile);

    // ── Step 4: Execute test queue concurrently ───────────────────────────────
    const queue: GeneratedTest[] = [];
    for (const plan of testPlans) {
      for (const test of plan.tests) {
        if (!test.isSkipped) queue.push(test);
      }
    }

    const totalTests = queue.length;
    callbacks.onStatus?.({
      phase: 'ready',
      message: `${totalTests} tests ready (${profile}, ${concurrency} parallel)`,
      totalTests,
    });

    this.testRunner.resetState();
    const allResults: TestResult[] = [];
    let completedCount = 0;
    const delay = dto.delayBetweenTests ?? 100;

    for (let i = 0; i < queue.length; i += concurrency) {
      if (callbacks.shouldContinue && !callbacks.shouldContinue()) break;

      const batch = queue.slice(i, i + concurrency);
      await Promise.all(
        batch.map(async (test) => {
          if (callbacks.shouldContinue && !callbacks.shouldContinue()) return;
          await this.testRunner.runTest(
            test,
            baseUrl,
            dto,
            authHeaders,
            authQueryParams,
            (r) => {
              allResults.push(r);
              completedCount++;
              callbacks.onTestResult?.({
                ...r,
                progress: { completed: completedCount, total: totalTests },
              });
            },
          );
        }),
      );

      if (i + concurrency < queue.length) {
        await this.sleep(delay);
      }
    }

    // ── Step 5: Request Chaining (POST → GET → DELETE) ────────────────────────
    if (dto.runChainTests !== false) {
      callbacks.onStatus?.({ phase: 'chaining', message: 'Running create→read→delete chain tests...' });
      const chainResults = await this.chainRunner.runChains(
        spec.endpoints,
        baseUrl,
        dto,
        authHeaders,
        authQueryParams,
        (r) => {
          allResults.push(r);
          completedCount++;
          callbacks.onTestResult?.({ ...r, progress: { completed: completedCount, total: totalTests } });
        },
      );
      if (chainResults.length > 0) {
        this.logger.log(`Chain tests: ${chainResults.length} step results`);
      }
    }

    // ── Step 6: IDOR / Authorization Testing ─────────────────────────────────
    if (dto.runIdorTests && dto.secondAuthType && dto.secondAuthType !== AuthType.NONE) {
      callbacks.onStatus?.({ phase: 'idor', message: 'Running IDOR / authorization tests...' });
      const secondAuthHeaders = await this.authHandler.resolveSecondAuthHeaders(dto);
      const idorResults = await this.idorChecker.runIdorChecks(
        spec.endpoints,
        baseUrl,
        authHeaders,
        secondAuthHeaders,
        dto,
        (r) => {
          allResults.push(r);
          callbacks.onTestResult?.({ ...r, progress: { completed: ++completedCount, total: totalTests } });
        },
      );
      if (idorResults.length > 0) {
        this.logger.log(`IDOR checks: ${idorResults.length} results`);
      }
    }

    // ── Step 7: JSON Schema Diff ──────────────────────────────────────────────
    // Annotate each result with a structural diff of its response body vs the
    // OpenAPI schema. Mutates results in-place; results with no matching schema
    // are left unchanged.
    this.schemaDiff.annotateResults(allResults, spec.endpoints ?? []);

    // Re-run the first 10 failures up to 5 times each to score non-determinism.
    // Uses the same runner + auth context so results are directly comparable.
    const failedResults = allResults.filter(
      (r) => r.status === 'FAIL' || r.status === 'ERROR',
    );

    const flakinessSummary = failedResults.length > 0
      ? await this.flakiness.analyzeFlakiness(failedResults, async (original) => {
          let rerunResult: TestResult | null = null;
          const testAsGenerated: GeneratedTest = {
            testName:       original.testName,
            method:         original.method as any,
            path:           original.path,
            headers:        (original as any).requestHeaders ?? {},
            queryParams:    (original as any).queryParams ?? {},
            body:           (original as any).requestBody ?? null,
            expectedStatus: Array.isArray(original.expected) ? original.expected : [original.expected],
            category:       original.category,
            description:    original.testName,
          };

          await this.testRunner.runTest(
            testAsGenerated,
            baseUrl,
            dto,
            authHeaders,
            authQueryParams,
            (r) => { rerunResult = r; },
          );
          return rerunResult!;
        })
      : undefined;

    // ── Step 9: Assemble the final report ────────────────────────────────────
    const report = this.reporter.generateReport(
      allResults,
      dto.swaggerUrl,
      baseUrl,
      spec.title,
      startedAt,
      this.testRunner.wasTokenExpiryDetected(),
      spec.endpoints ?? [],
    );

    if (flakinessSummary) {
      report.flakiness = flakinessSummary;
    }

    // ── Step 10: OWASP Security Probes ─────────────────────────────────────────
    if (dto.runSecurityProbes) {
      callbacks.onStatus?.({
        phase: 'security',
        message: 'Running OWASP API Security Top 10 probes...'
      });
      const secSummary = await this.security.runProbes(
        spec.endpoints ?? [],
        baseUrl,
        dto,
        authHeaders,
        allResults,
      );
      (report as any).securityProbes = secSummary;
    }

    // ── Step 11: Regression Baseline Comparison ───────────────────────────────
    if (dto.saveBaseline) {
      this.regression.saveBaseline(dto.saveBaseline, allResults);
      this.logger.log(`Baseline saved to ${dto.saveBaseline}`);
    }
    if (dto.baselineFile) {
      const diff = this.regression.compareToBaseline(dto.baselineFile, allResults);
      (report as any).regressionDiff = diff;
    }

    this.logger.log(`Run complete: ${report.passed}/${report.totalTests} passed (${profile})`);
    return report;
  }

  /** Async delay helper for throttling between test batches. */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
