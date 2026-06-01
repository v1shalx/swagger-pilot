
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { TestReport, TestResult, CATEGORY_LABELS } from '../types';

function safeJson(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  try { return JSON.stringify(val, null, 2); } catch { return String(val); }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'PASS': return '✅ PASS';
    case 'FAIL': return '❌ FAIL';
    case 'ERROR': return '⚠️ ERROR';
    case 'SKIPPED': return '⏭️ SKIPPED';
    default: return status;
  }
}

function statusFill(status: string): ExcelJS.Fill {
  const colors: Record<string, string> = {
    PASS: 'FFD4EDDA',
    FAIL: 'FFF8D7DA',
    ERROR: 'FFFFF3CD',
    SKIPPED: 'FFE2E3E5',
  };
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: colors[status] || 'FFFFFFFF' } };
}

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FF60A5FA' }, name: 'Arial', size: 10 };
const CELL_FONT: Partial<ExcelJS.Font> = { name: 'Arial', size: 9 };
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF334155' } },
  left: { style: 'thin', color: { argb: 'FF334155' } },
  bottom: { style: 'thin', color: { argb: 'FF334155' } },
  right: { style: 'thin', color: { argb: 'FF334155' } },
};

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.border = BORDER;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
  });
  row.height = 22;
}

function styleDataRow(row: ExcelJS.Row, status?: string) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = CELL_FONT;
    cell.border = BORDER;
    cell.alignment = { vertical: 'top', wrapText: true };
    if (status) cell.fill = statusFill(status);
  });
}

export async function exportToExcel(report: TestReport): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SwaggerPilot';
  wb.created = new Date();

  // ── Sheet 1: Summary ──────────────────────────────────────────────────────
  const wsSummary = wb.addWorksheet('📋 Summary');
  wsSummary.columns = [{ width: 30 }, { width: 60 }];

  const titleRow = wsSummary.addRow(['✈️ SwaggerPilot — Test Report', '']);
  wsSummary.mergeCells('A1:B1');
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF60A5FA' }, name: 'Arial' };
  titleRow.getCell(1).fill = HEADER_FILL;
  titleRow.getCell(1).alignment = { horizontal: 'center' };
  titleRow.height = 30;

  wsSummary.addRow([]);

  const metaRows: [string, string | number][] = [
    ['API Title', report.title],
    ['Swagger URL', report.swaggerUrl],
    ['Base URL', report.baseUrl],
    ['Started At', new Date(report.startedAt).toLocaleString()],
    ['Completed At', new Date(report.completedAt).toLocaleString()],
    ['Duration (s)', (report.durationMs / 1000).toFixed(1)],
  ];
  for (const [label, value] of metaRows) {
    const r = wsSummary.addRow([label, value]);
    r.getCell(1).font = { bold: true, name: 'Arial', size: 9 };
    r.getCell(2).font = CELL_FONT;
  }

  wsSummary.addRow([]);

  const statsHeader = wsSummary.addRow(['Metric', 'Count']);
  styleHeader(statsHeader);

  const stats: [string, number | string][] = [
    ['Total Tests', report.totalTests],
    ['✅ Passed', report.passed],
    ['❌ Failed', report.failed],
    ['⚠️ Errors', report.errors],
    ['⏭️ Skipped', report.skipped],
    ['Pass Rate', `${report.passRate}%`],
    ['AI-Generated Tests', report.allTests.filter((t) => t.isAiGenerated).length],
  ];
  for (const [label, val] of stats) {
    const r = wsSummary.addRow([label, val]);
    r.getCell(1).font = { bold: true, name: 'Arial', size: 9 };
    r.getCell(2).font = { bold: true, name: 'Arial', size: 9 };
    r.eachCell((c) => { c.border = BORDER; });
  }

  wsSummary.addRow([]);
  const warnRow = wsSummary.addRow([
    'Token Expiry Warning',
    report.tokenExpiryWarning ? '⚠️ YES — Some 401s may be due to expired token' : '✅ No',
  ]);
  warnRow.getCell(1).font = { bold: true, name: 'Arial', size: 9 };
  warnRow.getCell(2).font = {
    name: 'Arial', size: 9,
    color: { argb: report.tokenExpiryWarning ? 'FFDC2626' : 'FF16A34A' },
  };

  // ── Sheet 2: All Tests ────────────────────────────────────────────────────
  const wsAll = wb.addWorksheet('🧪 All Tests');
  wsAll.columns = [
    { header: '#', width: 5 },
    { header: 'Status', width: 14 },
    { header: 'Test Name', width: 45 },
    { header: 'Category', width: 20 },
    { header: 'Method', width: 9 },
    { header: 'Endpoint Path', width: 35 },
    { header: 'Full URL', width: 55 },
    { header: 'Expected Status Code(s)', width: 22 },
    { header: 'Actual Status Code', width: 18 },
    { header: 'Response Time (ms)', width: 18 },
    { header: 'AI Generated', width: 13 },
    { header: 'Description', width: 50 },
    { header: 'Request Payload (Body)', width: 50 },
    { header: 'Response Body', width: 50 },
    { header: 'Error Message', width: 40 },
  ];
  styleHeader(wsAll.getRow(1));

  report.allTests.forEach((t: TestResult, i: number) => {
    const r = wsAll.addRow([
      i + 1,
      statusLabel(t.status),
      t.testName,
      CATEGORY_LABELS[t.category] || t.category,
      t.method,
      t.path,
      t.fullUrl,
      t.expected.join(' OR '),
      t.actual ?? 'N/A',
      t.responseTime,
      t.isAiGenerated ? 'Yes' : 'No',
      t.description,
      safeJson(t.requestBody),
      safeJson(t.responseBody),
      t.errorMessage || '',
    ]);
    styleDataRow(r, t.status);
  });

  // ── Sheet 3: Failures & Errors ────────────────────────────────────────────
  const wsFail = wb.addWorksheet('❌ Failures & Errors');
  wsFail.columns = [
    { header: '#', width: 5 },
    { header: 'Status', width: 14 },
    { header: 'Test Name', width: 45 },
    { header: 'Category', width: 20 },
    { header: 'Method', width: 9 },
    { header: 'Endpoint Path', width: 35 },
    { header: 'Full URL', width: 55 },
    { header: 'Expected Status Code(s)', width: 22 },
    { header: 'Actual Status Code', width: 18 },
    { header: 'Response Time (ms)', width: 18 },
    { header: 'Description', width: 50 },
    { header: 'Request Payload (Body)', width: 50 },
    { header: 'Response Body', width: 50 },
    { header: 'Error Message', width: 40 },
  ];
  styleHeader(wsFail.getRow(1));

  if (report.failedTests.length === 0) {
    wsFail.addRow(['', '🎉 No failures — all tests passed!']);
  } else {
    report.failedTests.forEach((t: TestResult, i: number) => {
      const r = wsFail.addRow([
        i + 1,
        statusLabel(t.status),
        t.testName,
        CATEGORY_LABELS[t.category] || t.category,
        t.method,
        t.path,
        t.fullUrl,
        t.expected.join(' OR '),
        t.actual ?? 'N/A',
        t.responseTime,
        t.description,
        safeJson(t.requestBody),
        safeJson(t.responseBody),
        t.errorMessage || '',
      ]);
      styleDataRow(r, t.status);
    });
  }

  // ── Sheet 4: By Endpoint ──────────────────────────────────────────────────
  const wsEp = wb.addWorksheet('📊 By Endpoint');
  wsEp.columns = [
    { header: 'Method', width: 10 },
    { header: 'Endpoint', width: 40 },
    { header: 'Total', width: 8 },
    { header: '✅ Passed', width: 10 },
    { header: '❌ Failed', width: 10 },
    { header: '⚠️ Errors', width: 10 },
    { header: '⏭️ Skipped', width: 10 },
    { header: 'Pass Rate', width: 10 },
  ];
  styleHeader(wsEp.getRow(1));
  for (const ep of report.byEndpoint) {
    const nonSkipped = ep.total - ep.skipped;
    const rate = nonSkipped > 0 ? Math.round((ep.passed / nonSkipped) * 100) : 0;
    const r = wsEp.addRow([ep.method, ep.endpoint, ep.total, ep.passed, ep.failed, ep.errors, ep.skipped, `${rate}%`]);
    styleDataRow(r);
  }

  // ── Sheet 5: By Category ──────────────────────────────────────────────────
  const wsCat = wb.addWorksheet('🏷️ By Category');
  wsCat.columns = [
    { header: 'Category', width: 26 },
    { header: 'Total', width: 8 },
    { header: '✅ Passed', width: 10 },
    { header: '❌ Failed', width: 10 },
    { header: 'Pass Rate', width: 10 },
  ];
  styleHeader(wsCat.getRow(1));
  for (const c of report.byCategory) {
    const rate = c.total > 0 ? Math.round((c.passed / c.total) * 100) : 0;
    const r = wsCat.addRow([CATEGORY_LABELS[c.category] || c.category, c.total, c.passed, c.failed, `${rate}%`]);
    styleDataRow(r);
  }

  // ── Write file ────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `swagger-pilot-report-${timestamp}.xlsx`);
}

export function exportToCsv(report: TestReport): void {
  const headers = [
    'Status', 'Test Name', 'Category', 'Method', 'Endpoint Path', 'Full URL',
    'Expected Status Code(s)', 'Actual Status Code', 'Response Time (ms)',
    'AI Generated', 'Description', 'Request Payload', 'Response Body', 'Error Message',
  ];
  const escape = (v: any) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = report.allTests.map((t: TestResult) => [
    t.status, t.testName, CATEGORY_LABELS[t.category] || t.category,
    t.method, t.path, t.fullUrl, t.expected.join(' OR '),
    t.actual ?? '', t.responseTime, t.isAiGenerated ? 'Yes' : 'No',
    t.description, safeJson(t.requestBody), safeJson(t.responseBody), t.errorMessage || '',
  ]);
  const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `swagger-pilot-report-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
