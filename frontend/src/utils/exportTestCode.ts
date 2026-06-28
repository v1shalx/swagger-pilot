/**
 * @file exportTestCode.ts
 * @description Generates a runnable Java Rest-Assured test class from a
 * completed SwaggerPilot report and triggers a browser download.
 *
 * The generated file can be dropped directly into the java-tests module
 * alongside PetstoreApiTest.java and run with:
 *   mvn test -Dtest=GeneratedApiTest -pl java-tests
 *
 * Test organisation:
 *  - One @Test method per unique (method, path, category) combination
 *  - Tests grouped by endpoint using inline comments
 *  - Auth tests always included (they verify 401/403 behaviour)
 *  - Happy-path and boundary tests grouped separately
 *  - Maximum 40 test methods to keep the file readable
 */

import { TestReport, TestResult } from '../types';

// ── Helpers ────────────────────────────────────────────────────────────────

function toMethodName(result: TestResult, index: number): string {
  const path = result.path.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const cat  = result.category.replace(/[^a-zA-Z0-9]/g, '_');
  return `${result.method.toLowerCase()}_${path}_${cat}_${index}`;
}

function javaStringLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return `"${JSON.stringify(value).replace(/"/g, '\\"')}"`;
}

function bodySnippet(body: unknown): string {
  if (body === null || body === undefined) return '';
  try {
    const json = JSON.stringify(body, null, 4)
      .split('\n')
      .map((l, i) => (i === 0 ? l : '            ' + l))
      .join('\n');
    return `        .body(${javaStringLiteral(json)})\n`;
  } catch {
    return '';
  }
}

function statusMatcher(expected: number[]): string {
  if (expected.length === 1) return `equalTo(${expected[0]})`;
  return `anyOf(${expected.map((s) => `equalTo(${s})`).join(', ')})`;
}

function categoryGroup(cat: string): string {
  const map: Record<string, string> = {
    'auth':           'auth',
    'happy-path':     'smoke',
    'boundary':       'boundary',
    'body':           'validation',
    'required-field': 'validation',
    'type-validation':'validation',
    'format':         'validation',
    'path-param':     'parametrised',
    'query-param':    'parametrised',
    'ai-edge-case':   'ai-edge-case',
    'flow':           'chain',
    'authorization_leak': 'security',
  };
  return map[cat] ?? 'general';
}

// ── Main export ───────────────────────────────────────────────────────────

/**
 * Generate a Rest-Assured test class from a SwaggerPilot report and
 * trigger a `.java` file download in the browser.
 *
 * @param report - The completed test report to convert
 */
export function exportTestCode(report: TestReport): void {
  const className   = `Generated_${report.title.replace(/[^a-zA-Z0-9]/g, '_')}_ApiTest`;
  const generatedAt = new Date().toISOString();
  const baseUri     = report.baseUrl;

  // Pick a representative slice of tests (max 40, prioritise variety)
  const priority = ['auth', 'happy-path', 'boundary', 'body', 'ai-edge-case'];
  const all      = [...report.allTests].filter((t) => t.status !== 'SKIPPED');
  const sorted   = [
    ...priority.flatMap((cat) => all.filter((t) => t.category === cat)),
    ...all.filter((t) => !priority.includes(t.category)),
  ];
  const selected = sorted.slice(0, 40);

  // Group by endpoint path for inline comments
  const grouped = new Map<string, TestResult[]>();
  for (const t of selected) {
    const key = `${t.method} ${t.path}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(t);
  }

  // Generate test methods
  const methodBlocks: string[] = [];
  let idx = 0;

  for (const [endpoint, tests] of grouped) {
    methodBlocks.push(`\n    // ── ${endpoint} ${'─'.repeat(Math.max(0, 50 - endpoint.length))}`);

    for (const t of tests) {
      const name    = toMethodName(t, idx++);
      const group   = categoryGroup(t.category);
      const hasBody = t.requestBody !== null && t.requestBody !== undefined;
      const body    = hasBody ? bodySnippet(t.requestBody) : '';
      const path    = t.path.replace(/\{([^}]+)\}/g, '{$1}');

      methodBlocks.push(`
    /**
     * ${t.testName}
     * Category: ${t.category} | Status: ${t.status} (${t.actual ?? 'N/A'})
     */
    @Test(groups = "${group}", description = "${t.testName.replace(/"/g, "'")}")
    public void ${name}() {
        given(spec)
${body}        .when()
            .${t.method.toLowerCase()}("${path}")
        .then()
            .statusCode(${statusMatcher(t.expected)});
    }`);
    }
  }

  // ── Assemble the full Java file ───────────────────────────────────────
  const java = `/**
 * Auto-generated Rest-Assured test suite
 *
 * Source API : ${report.title}
 * Spec URL   : ${report.swaggerUrl}
 * Generated  : ${generatedAt}
 * Tool       : SwaggerPilot automated OpenAPI audit engine
 *
 * HOW TO RUN
 * ----------
 * 1. Copy this file into: java-tests/src/test/java/com/swaggerpilot/generated/
 * 2. Set environment variables:
 *      API_BASE_URL=${baseUri}
 *      API_AUTH_TOKEN=<your-token>   (if auth is required)
 * 3. Execute:
 *      mvn test -Dtest=${className} -pl java-tests
 *    Or run a specific group:
 *      mvn test -Dtest=${className}#smoke -pl java-tests
 *
 * TEST GROUPS
 * -----------
 *  smoke        — happy-path tests, quick sanity check
 *  auth         — authentication / authorisation behaviour
 *  boundary     — edge-case and boundary value tests
 *  validation   — request body and field validation
 *  ai-edge-case — AI-generated adversarial inputs
 *  security     — IDOR / authorisation leak tests
 *
 * TOTAL TESTS IN THIS FILE: ${selected.length}
 * (from ${report.totalTests} discovered in the original run)
 */
package com.swaggerpilot.generated;

import io.restassured.RestAssured;
import io.restassured.specification.RequestSpecification;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class ${className} {

    private static RequestSpecification spec;

    @BeforeClass
    public static void setup() {
        RestAssured.baseURI = System.getenv().getOrDefault("API_BASE_URL", "${baseUri}");
        RestAssured.enableLoggingOfRequestAndResponseIfValidationFails();

        spec = given()
                .header("Accept", "application/json")
                .header("Content-Type", "application/json");

        final String token = System.getenv("API_AUTH_TOKEN");
        if (token != null && !token.isBlank()) {
            spec = spec.header("Authorization", "Bearer " + token);
        }
    }
${methodBlocks.join('\n')}
}
`;

  // Trigger browser download
  const blob = new Blob([java], { type: 'text/x-java-source' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${className}.java`;
  a.click();
  URL.revokeObjectURL(url);
}
