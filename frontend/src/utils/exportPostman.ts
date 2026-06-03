import { TestReport, TestResult } from '../types';

function buildRequest(result: TestResult, baseUrl: string) {
  const headers: { key: string; value: string }[] = [
    { key: 'Accept', value: '*/*' },
  ];

  if (result.category === 'auth' && result.testName.includes('Invalid')) {
    headers.push({ key: 'Authorization', value: 'Bearer invalid_token_abc123xyz' });
  } else if (!(result.category === 'auth' && result.testName.includes('No auth'))) {
    headers.push({ key: 'Authorization', value: 'Bearer {{authToken}}' });
  }

  const hasBody =
    result.requestBody !== null &&
    result.requestBody !== undefined &&
    ['POST', 'PUT', 'PATCH'].includes(result.method);

  if (hasBody) {
    headers.push({ key: 'Content-Type', value: 'application/json' });
  }

  const bodyStr =
    hasBody && result.requestBody
      ? typeof result.requestBody === 'string'
        ? result.requestBody
        : JSON.stringify(result.requestBody, null, 2)
      : undefined;

  return {
    method: result.method,
    header: headers,
    body: bodyStr
      ? { mode: 'raw' as const, raw: bodyStr }
      : undefined,
    url: {
      raw: result.fullUrl,
      host: ['{{baseUrl}}'],
      path: result.path.replace(/^\//, '').split('/').filter(Boolean),
    },
    description: `${result.description}\n\nExpected: ${result.expected.join(' or ')}\nActual: ${result.actual ?? 'N/A'}\n${result.errorMessage || ''}`,
  };
}

export function exportFailedTestsToPostman(report: TestReport): void {
  const failures = report.failedTests.length > 0
    ? report.failedTests
    : report.allTests.filter((t) => t.status === 'FAIL' || t.status === 'ERROR');

  const collection = {
    info: {
      name: `SwaggerPilot — ${report.title} (Failed Tests)`,
      description: `Exported ${failures.length} failed/error cases from SwaggerPilot audit on ${new Date(report.completedAt).toLocaleString()}`,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: [
      { key: 'baseUrl', value: report.baseUrl },
      { key: 'authToken', value: 'YOUR_TOKEN_HERE' },
    ],
    item: failures.map((t) => ({
      name: `[${t.status}] ${t.method} ${t.path} — ${t.testName.replace(`${t.method} ${t.path} — `, '')}`,
      request: buildRequest(t, report.baseUrl),
    })),
  };

  const json = JSON.stringify(collection, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `swagger-pilot-failures-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.postman_collection.json`;
  a.click();
  URL.revokeObjectURL(url);
}
