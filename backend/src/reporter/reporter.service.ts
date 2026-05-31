import { Injectable } from '@nestjs/common';
import { TestResult } from '../test-runner/test-runner.service';

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
  generateReport(
    results: TestResult[],
    swaggerUrl: string,
    baseUrl: string,
    title: string,
    startedAt: Date,
    tokenExpiryWarning: boolean,
  ): TestReport {
    const completedAt = new Date();
    const nonSkipped = results.filter((r) => r.status !== 'SKIPPED');

    const passed = results.filter((r) => r.status === 'PASS').length;
    const failed = results.filter((r) => r.status === 'FAIL').length;
    const errors = results.filter((r) => r.status === 'ERROR').length;
    const skipped = results.filter((r) => r.status === 'SKIPPED').length;
    const total = nonSkipped.length;

    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    // Group by endpoint
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

    // Group by category
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
      failedTests: results.filter((r) => r.status === 'FAIL' || r.status === 'ERROR'),
      allTests: results,
    };
  }
}
