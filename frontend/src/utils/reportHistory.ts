import { TestReport } from '../types';

const HISTORY_KEY = 'swagger-pilot-run-history';
const LAST_KEY = 'swagger-pilot-last-report';
const MAX_RUNS = 25;

export interface SavedReportSnapshot {
  savedAt: string;
  report: TestReport;
  projectKey: string;
}

export interface RegressionDelta {
  hasPrevious: boolean;
  previousDate?: string;
  passRateDelta: number;
  newFailures: number;
  fixedFailures: number;
  previousPassRate?: number;
}

function projectKey(report: TestReport) {
  return `${report.swaggerUrl}::${report.baseUrl}`;
}

function failureKey(t: { method: string; path: string; testName: string }) {
  return `${t.method}|${t.path}|${t.testName}`;
}

export function saveReportSnapshot(report: TestReport): void {
  const key = projectKey(report);
  const snapshot: SavedReportSnapshot = {
    savedAt: new Date().toISOString(),
    report,
    projectKey: key,
  };
  localStorage.setItem(LAST_KEY, JSON.stringify(snapshot));

  let history: SavedReportSnapshot[] = [];
  try {
    history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    history = [];
  }
  history = history.filter((h) => h.projectKey !== key);
  history.unshift(snapshot);
  if (history.length > MAX_RUNS) history = history.slice(0, MAX_RUNS);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function loadRunHistory(projectKey?: string): SavedReportSnapshot[] {
  try {
    const history: SavedReportSnapshot[] = JSON.parse(
      localStorage.getItem(HISTORY_KEY) || '[]',
    );
    if (projectKey) return history.filter((h) => h.projectKey === projectKey);
    return history;
  } catch {
    return [];
  }
}

export function compareWithPreviousReport(report: TestReport): RegressionDelta {
  const key = projectKey(report);
  const history = loadRunHistory(key).filter(
    (h) => h.report.completedAt !== report.completedAt,
  );
  const prev = history[0];
  if (!prev?.report) {
    return { hasPrevious: false, passRateDelta: 0, newFailures: 0, fixedFailures: 0 };
  }

  const prevFails = new Set(
    prev.report.allTests
      .filter((t) => t.status === 'FAIL' || t.status === 'ERROR')
      .map(failureKey),
  );
  const currFails = new Set(
    report.allTests
      .filter((t) => t.status === 'FAIL' || t.status === 'ERROR')
      .map(failureKey),
  );

  let newFailures = 0;
  let fixedFailures = 0;
  for (const k of currFails) if (!prevFails.has(k)) newFailures++;
  for (const k of prevFails) if (!currFails.has(k)) fixedFailures++;

  return {
    hasPrevious: true,
    previousDate: prev.savedAt,
    passRateDelta: report.passRate - prev.report.passRate,
    newFailures,
    fixedFailures,
    previousPassRate: prev.report.passRate,
  };
}

export function estimateHoursSaved(testCount: number): number {
  return Math.round((testCount * 2) / 6) / 10;
}
