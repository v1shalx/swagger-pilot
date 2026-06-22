/**
 * Unit tests — RegressionService
 * Tests baseline save/compare logic using a temp file.
 */
import { RegressionService } from './regression.service';
import { TestResult } from '../test-runner/test-runner.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function makeResult(overrides: Partial<TestResult> & Pick<TestResult, 'testName' | 'method' | 'path' | 'status' | 'actual'>): TestResult {
  return {
    fullUrl: `http://localhost${overrides.path}`,
    expected: [200],
    responseTime: 100,
    category: 'happy-path',
    description: 'test',
    isAiGenerated: false,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('RegressionService', () => {
  let service: RegressionService;
  let tmpFile: string;

  beforeEach(() => {
    service = new RegressionService();
    tmpFile = path.join(os.tmpdir(), `swaggerpilot-baseline-${Date.now()}.json`);
  });

  afterEach(() => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  });

  // ── Save baseline ──────────────────────────────────────────────────────────

  it('saves a baseline file with the correct structure', () => {
    const results: TestResult[] = [
      makeResult({ testName: 'GET /users — happy path', method: 'GET', path: '/users', status: 'PASS', actual: 200 }),
      makeResult({ testName: 'GET /users — No auth', method: 'GET', path: '/users', status: 'PASS', actual: 401 }),
    ];

    service.saveBaseline(tmpFile, results);
    expect(fs.existsSync(tmpFile)).toBe(true);

    const saved = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
    expect(saved.entries).toHaveLength(2);
    expect(saved.savedAt).toBeDefined();
  });

  it('excludes SKIPPED tests from baseline', () => {
    const results: TestResult[] = [
      makeResult({ testName: 'GET /users', method: 'GET', path: '/users', status: 'PASS', actual: 200 }),
      makeResult({ testName: 'POST /upload — SKIPPED', method: 'POST', path: '/upload', status: 'SKIPPED', actual: null }),
    ];
    service.saveBaseline(tmpFile, results);
    const saved = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
    expect(saved.entries).toHaveLength(1);
    expect(saved.entries[0].status).toBe('PASS');
  });

  // ── Compare ───────────────────────────────────────────────────────────────

  it('detects newly failing tests', () => {
    const baseline: TestResult[] = [
      makeResult({ testName: 'GET /users/{id} — happy path', method: 'GET', path: '/users/{id}', status: 'PASS', actual: 200 }),
    ];
    service.saveBaseline(tmpFile, baseline);

    const current: TestResult[] = [
      makeResult({ testName: 'GET /users/{id} — happy path', method: 'GET', path: '/users/{id}', status: 'FAIL', actual: 500 }),
    ];
    const diff = service.compareToBaseline(tmpFile, current);
    expect(diff.newlyFailing).toHaveLength(1);
    expect(diff.newlyPassing).toHaveLength(0);
  });

  it('detects newly passing tests', () => {
    const baseline: TestResult[] = [
      makeResult({ testName: 'POST /users — happy path', method: 'POST', path: '/users', status: 'FAIL', actual: 500 }),
    ];
    service.saveBaseline(tmpFile, baseline);

    const current: TestResult[] = [
      makeResult({ testName: 'POST /users — happy path', method: 'POST', path: '/users', status: 'PASS', actual: 201 }),
    ];
    const diff = service.compareToBaseline(tmpFile, current);
    expect(diff.newlyPassing).toHaveLength(1);
    expect(diff.newlyFailing).toHaveLength(0);
  });

  it('detects status code changes (both PASS → PASS but different code)', () => {
    const baseline: TestResult[] = [
      makeResult({ testName: 'DELETE /users/{id} — happy path', method: 'DELETE', path: '/users/{id}', status: 'PASS', actual: 200 }),
    ];
    service.saveBaseline(tmpFile, baseline);

    const current: TestResult[] = [
      makeResult({ testName: 'DELETE /users/{id} — happy path', method: 'DELETE', path: '/users/{id}', status: 'PASS', actual: 204 }),
    ];
    const diff = service.compareToBaseline(tmpFile, current);
    expect(diff.statusChanged).toHaveLength(1);
    expect(diff.newlyFailing).toHaveLength(0);
  });

  it('counts unchanged tests correctly', () => {
    const results: TestResult[] = [
      makeResult({ testName: 'GET /a', method: 'GET', path: '/a', status: 'PASS', actual: 200 }),
      makeResult({ testName: 'GET /b', method: 'GET', path: '/b', status: 'FAIL', actual: 500 }),
    ];
    service.saveBaseline(tmpFile, results);
    const diff = service.compareToBaseline(tmpFile, results); // same results
    expect(diff.unchanged).toBe(2);
    expect(diff.newlyFailing).toHaveLength(0);
    expect(diff.newlyPassing).toHaveLength(0);
    expect(diff.summary).toContain('No regressions');
  });

  it('throws if baseline file does not exist', () => {
    expect(() =>
      service.compareToBaseline('/tmp/nonexistent-file-xyz.json', []),
    ).toThrow();
  });
});
