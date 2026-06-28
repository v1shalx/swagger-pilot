/**
 * @file flakiness.service.ts
 * @description Detects flaky tests by re-running individual test cases up to
 * {@link FLAKINESS_RUN_COUNT} times and analysing pass/fail consistency.
 *
 * A test is considered:
 *  - `STABLE`       — same outcome in every run (all pass or all fail)
 *  - `FLAKY`        — 1–2 inconsistent results out of 5 runs
 *  - `HIGHLY_FLAKY` — 3+ inconsistent results out of 5 runs (never stable)
 *
 * Why this matters for an SDET portfolio:
 *  Flaky tests cause engineers to ignore CI failures. Detecting and surfacing
 *  them automatically is a high-value SDET contribution — it directly reduces
 *  alert fatigue and false-positive noise in the pipeline.
 *
 * Integration:
 *  The {@link RunOrchestratorService} calls {@link FlakinessService.analyzeFlakiness}
 *  after the primary run completes. Only FAIL / ERROR results are re-run since
 *  a test that passed on the first attempt is unlikely to be flaky in practice.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TestResult } from '../test-runner/test-runner.service';

// ── Constants ────────────────────────────────────────────────────────────────

/** Number of times each suspect test is re-executed to determine stability. */
const FLAKINESS_RUN_COUNT = 5;

// ── Interfaces ────────────────────────────────────────────────────────────────

/** Stability verdict for a single test case. */
export type FlakinessScore = 'STABLE' | 'FLAKY' | 'HIGHLY_FLAKY';

/**
 * Per-test flakiness entry included in the final report.
 */
export interface FlakinessEntry {
  /** Unique identifier: `"METHOD PATH testName"`. */
  testKey: string;
  /** Display name of the test case. */
  testName: string;
  /** HTTP method, e.g. `"GET"`. */
  method: string;
  /** API path, e.g. `"/pets/{petId}"`. */
  path: string;
  /** Stability verdict. */
  score: FlakinessScore;
  /**
   * Array of pass/fail outcomes per run.
   * `true` = PASS, `false` = FAIL or ERROR.
   */
  runResults: boolean[];
  /** Number of runs that passed. */
  passCount: number;
  /** Human-readable summary, e.g. "Passed 2/5 runs — FLAKY". */
  summary: string;
}

/**
 * Aggregated flakiness report attached to {@link TestReport}.
 */
export interface FlakinessSummary {
  /** Tests re-run to check stability. */
  totalAnalyzed: number;
  /** Tests where every run had the same outcome. */
  stableCount: number;
  /** Tests with 1–2 inconsistent results. */
  flakyCount: number;
  /** Tests that were never consistent across runs. */
  highlyFlakyCount: number;
  /** Per-test breakdown sorted by severity (highly-flaky first). */
  entries: FlakinessEntry[];
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class FlakinessService {
  private readonly logger = new Logger(FlakinessService.name);

  /**
   * Analyse a set of failed test results for flakiness.
   *
   * For each failed test, this method re-runs it {@link FLAKINESS_RUN_COUNT} times
   * using the provided `rerunFn` and computes a stability score.
   *
   * @param failedResults - Tests that failed on the first pass (FAIL or ERROR).
   * @param rerunFn       - Async function that executes a single test and returns
   *                        its updated {@link TestResult}. Provided by the runner.
   * @returns A {@link FlakinessSummary} ready to attach to the report.
   */
  async analyzeFlakiness(
    failedResults: TestResult[],
    rerunFn: (result: TestResult) => Promise<TestResult>,
  ): Promise<FlakinessSummary> {
    const entries: FlakinessEntry[] = [];

    // Limit to the first 10 failures to avoid excessive re-run time
    const candidates = failedResults.slice(0, 10);

    this.logger.log(
      `Flakiness check: re-running ${candidates.length} failed tests × ${FLAKINESS_RUN_COUNT} times`,
    );

    for (const original of candidates) {
      const testKey = `${original.method} ${original.path} ${original.testName}`;
      const runResults: boolean[] = [];

      // Re-run the same test N times
      for (let attempt = 1; attempt <= FLAKINESS_RUN_COUNT; attempt++) {
        try {
          const result = await rerunFn(original);
          runResults.push(result.status === 'PASS');
        } catch {
          // A thrown error is treated as a failure in that run
          runResults.push(false);
        }
      }

      const passCount = runResults.filter(Boolean).length;
      const score = this.computeScore(runResults);

      entries.push({
        testKey,
        testName:   original.testName,
        method:     original.method,
        path:       original.path,
        score,
        runResults,
        passCount,
        summary:    `Passed ${passCount}/${FLAKINESS_RUN_COUNT} runs — ${score}`,
      });

      this.logger.debug(`${testKey} → ${score} (${passCount}/${FLAKINESS_RUN_COUNT})`);
    }

    // Sort by severity: HIGHLY_FLAKY → FLAKY → STABLE
    const severityOrder: Record<FlakinessScore, number> = {
      HIGHLY_FLAKY: 0,
      FLAKY:        1,
      STABLE:       2,
    };
    entries.sort((a, b) => severityOrder[a.score] - severityOrder[b.score]);

    return {
      totalAnalyzed:    entries.length,
      stableCount:      entries.filter((e) => e.score === 'STABLE').length,
      flakyCount:       entries.filter((e) => e.score === 'FLAKY').length,
      highlyFlakyCount: entries.filter((e) => e.score === 'HIGHLY_FLAKY').length,
      entries,
    };
  }

  /**
   * Assign a {@link FlakinessScore} based on the pass/fail pattern.
   *
   * Decision logic:
   *  - All same outcome → `STABLE` (either always-pass or always-fail is expected)
   *  - 1–2 flips out of N → `FLAKY`
   *  - 3+ flips → `HIGHLY_FLAKY`
   *
   * "Flips" = transitions between pass and fail in the run sequence.
   * We count transitions rather than just the minority count because a test
   * that goes PASS→FAIL→PASS→FAIL→PASS is more flaky than one that goes
   * FAIL→FAIL→FAIL→FAIL→PASS (which might just be a fixed race condition).
   *
   * @param runResults - Boolean array: `true` = PASS for that run.
   */
  private computeScore(runResults: boolean[]): FlakinessScore {
    if (runResults.length === 0) return 'STABLE';

    // Count transitions between consecutive runs
    let transitions = 0;
    for (let i = 1; i < runResults.length; i++) {
      if (runResults[i] !== runResults[i - 1]) {
        transitions++;
      }
    }

    if (transitions === 0)  return 'STABLE';
    if (transitions <= 2)   return 'FLAKY';
    return 'HIGHLY_FLAKY';
  }
}
