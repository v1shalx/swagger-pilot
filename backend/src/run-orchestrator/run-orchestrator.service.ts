import { Injectable, Logger } from '@nestjs/common';
import { SwaggerParserService } from '../swagger-parser/swagger-parser.service';
import { TestGeneratorService, EndpointTestPlan } from '../test-generator/test-generator.service';
import { TestRunnerService, TestResult } from '../test-runner/test-runner.service';
import { AuthHandlerService } from '../test-runner/auth-handler.service';
import { ChainRunnerService } from '../test-runner/chain-runner.service';
import { IdorCheckerService } from '../test-runner/idor-checker.service';
import { RegressionService } from '../reporter/regression.service';
import { ReporterService, TestReport } from '../reporter/reporter.service';
import { CustomTestParserService } from '../custom-test-parser/custom-test-parser.service';
import { RunTestsDto, AuthType } from '../swagger-parser/swagger-parser.dto';
import { GeneratedTest } from '../test-generator/rule-engine.service';

export type RunProfile = 'smoke' | 'full';

const SMOKE_CATEGORIES = new Set(['auth', 'happy-path']);

export interface RunProgressCallbacks {
  onStatus?: (data: { phase: string; message: string; totalTests?: number; spec?: unknown }) => void;
  onWarning?: (message: string) => void;
  onTestResult?: (result: TestResult & { progress?: { completed: number; total: number } }) => void;
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
    private readonly customTestParser: CustomTestParserService,
  ) {}

  applyRunProfile(plans: EndpointTestPlan[], profile?: RunProfile): EndpointTestPlan[] {
    if (profile !== 'smoke') return plans;
    return plans.map((plan) => ({
      ...plan,
      tests: plan.tests.filter(
        (t) => t.isSkipped || SMOKE_CATEGORIES.has(t.category),
      ),
    }));
  }

  async executeRun(dto: RunTestsDto, callbacks: RunProgressCallbacks = {}): Promise<TestReport> {
    const startedAt = new Date();
    const profile = dto.runProfile ?? 'full';
    const skipAi = profile === 'smoke' || !!dto.skipAiGeneration;
    const concurrency = Math.min(Math.max(dto.maxConcurrent ?? 3, 1), 8);

    callbacks.onStatus?.({ phase: 'parsing', message: 'Fetching and parsing Swagger spec...' });

    let spec: any;
    if (dto.swaggerUrl === '__manual_only__') {
      spec = {
        title: 'Manual Tests',
        version: '1.0',
        baseUrl: dto.baseUrl,
        securitySchemes: {},
        endpoints: [],
        openApiVersion: '3.0',
      };
    } else {
      spec = await this.swaggerParser.parseSwaggerUrl(dto.swaggerUrl, dto.baseUrl);
    }

    const baseUrl = dto.baseUrl || spec.baseUrl;

    // Filter endpoints by selectedEndpoints if provided
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

    this.authHandler.clearCache();
    const authHeaders = await this.authHandler.resolveAuthHeaders(dto);
    const authQueryParams = this.authHandler.resolveAuthQueryParams(dto);
    const hasAuth = dto.authType !== AuthType.NONE;

    callbacks.onStatus?.({
      phase: 'generating',
      message: profile === 'smoke' ? 'Generating smoke tests (auth + happy path)...' : 'Generating test cases...',
    });

    let testPlans = await this.testGenerator.generateAllTests(spec, hasAuth, skipAi);
    testPlans = this.applyRunProfile(testPlans, profile);

    const customTests = (dto as RunTestsDto & { customTests?: string; customTestsType?: string }).customTests;
    const customTestsType = (dto as RunTestsDto & { customTestsType?: 'json' | 'csv' }).customTestsType;
    if (customTests && customTestsType) {
      try {
        const parsed = this.customTestParser.parseFileContent(customTests, customTestsType);
        testPlans.push({
          endpoint: 'custom-uploaded',
          method: 'MIXED',
          summary: 'Uploaded test cases',
          tests: parsed,
          skipped: false,
        });
      } catch (err) {
        callbacks.onWarning?.(`Custom test file error: ${err.message}`);
      }
    }

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

    // ── Feature 2: Request Chaining ─────────────────────────────────────────
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

    // ── Feature 3: IDOR Testing ──────────────────────────────────────────────
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

    const report = this.reporter.generateReport(
      allResults,
      dto.swaggerUrl,
      baseUrl,
      spec.title,
      startedAt,
      this.testRunner.wasTokenExpiryDetected(),
      spec.endpoints ?? [],
    );

    // ── Feature 4: Regression Baseline ──────────────────────────────────────
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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
