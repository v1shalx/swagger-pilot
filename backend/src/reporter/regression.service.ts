/**
 * Feature 4 — Regression Baseline + Diff
 *
 * Save a baseline:  regression.saveBaseline('baselines/main.json', results)
 * Compare:          regression.compareToBaseline('baselines/main.json', results)
 *
 * The diff reports:
 *   - newly failing endpoints (were passing, now failing/error)
 *   - newly passing endpoints (were failing, now passing)
 *   - status-code changes per endpoint
 */
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { TestResult } from '../test-runner/test-runner.service';

export interface BaselineEntry {
  key: string;        // `${method} ${path} ${testName}`
  status: string;
  actual: number | null;
}

export interface RegressionDiffItem {
  key: string;
  type: 'newly_failing' | 'newly_passing' | 'status_changed';
  before: { status: string; actual: number | null };
  after: { status: string; actual: number | null };
}

export interface RegressionDiff {
  baselineFile: string;
  newlyFailing: RegressionDiffItem[];
  newlyPassing: RegressionDiffItem[];
  statusChanged: RegressionDiffItem[];
  unchanged: number;
  summary: string;
}

@Injectable()
export class RegressionService {
  private readonly logger = new Logger(RegressionService.name);

  saveBaseline(filePath: string, results: TestResult[]): void {
    const resolved = path.resolve(filePath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });

    const entries: BaselineEntry[] = results
      .filter((r) => r.status !== 'SKIPPED')
      .map((r) => ({
        key: `${r.method} ${r.path} — ${r.testName}`,
        status: r.status,
        actual: r.actual,
      }));

    fs.writeFileSync(resolved, JSON.stringify({ savedAt: new Date().toISOString(), entries }, null, 2));
    this.logger.log(`Baseline saved: ${entries.length} results → ${resolved}`);
  }

  compareToBaseline(filePath: string, currentResults: TestResult[]): RegressionDiff {
    const resolved = path.resolve(filePath);

    if (!fs.existsSync(resolved)) {
      throw new Error(`Baseline file not found: ${resolved}`);
    }

    const { entries: baselineEntries }: { entries: BaselineEntry[] } = JSON.parse(
      fs.readFileSync(resolved, 'utf-8'),
    );

    const baselineMap = new Map<string, BaselineEntry>(
      baselineEntries.map((e) => [e.key, e]),
    );

    const currentMap = new Map<string, { status: string; actual: number | null }>(
      currentResults
        .filter((r) => r.status !== 'SKIPPED')
        .map((r) => [
          `${r.method} ${r.path} — ${r.testName}`,
          { status: r.status, actual: r.actual },
        ]),
    );

    const newlyFailing: RegressionDiffItem[] = [];
    const newlyPassing: RegressionDiffItem[] = [];
    const statusChanged: RegressionDiffItem[] = [];
    let unchanged = 0;

    for (const [key, before] of baselineMap) {
      const after = currentMap.get(key);
      if (!after) continue; // test removed — skip

      const wasOk = before.status === 'PASS';
      const isOk = after.status === 'PASS';

      if (wasOk && !isOk) {
        newlyFailing.push({ key, type: 'newly_failing', before, after });
      } else if (!wasOk && isOk) {
        newlyPassing.push({ key, type: 'newly_passing', before, after });
      } else if (before.actual !== after.actual) {
        statusChanged.push({ key, type: 'status_changed', before, after });
      } else {
        unchanged++;
      }
    }

    const summary =
      newlyFailing.length === 0 && newlyPassing.length === 0 && statusChanged.length === 0
        ? `No regressions — ${unchanged} tests unchanged`
        : `${newlyFailing.length} new failures, ${newlyPassing.length} fixed, ${statusChanged.length} status changes`;

    return {
      baselineFile: resolved,
      newlyFailing,
      newlyPassing,
      statusChanged,
      unchanged,
      summary,
    };
  }
}
