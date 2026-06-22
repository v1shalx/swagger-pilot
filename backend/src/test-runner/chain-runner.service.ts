/**
 * Feature 2 — Request Chaining (create → read → delete)
 *
 * Auto-detects resources that have:
 *   POST /resource            (create)
 *   GET  /resource/{id}       (read)
 *   DELETE /resource/{id}     (delete)
 *
 * Captures an `id` field (or uuid) from the POST response body,
 * injects it into subsequent path params via {{id}} substitution,
 * and always attempts the DELETE cleanup even if an intermediate step fails.
 */
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ParsedEndpoint, RunTestsDto } from '../swagger-parser/swagger-parser.dto';
import { TestResult } from './test-runner.service';

export interface ChainFlow {
  resource: string;           // e.g. "pets"
  create: ParsedEndpoint;
  read: ParsedEndpoint;
  delete: ParsedEndpoint;
}

export interface ExtractRule {
  variable: string;           // name of variable to set
  jsonPath: string;           // dot-path like "id" or "data.id"
}

@Injectable()
export class ChainRunnerService {
  private readonly logger = new Logger(ChainRunnerService.name);

  // ── Flow detection ────────────────────────────────────────────────────────

  detectFlows(endpoints: ParsedEndpoint[]): ChainFlow[] {
    const flows: ChainFlow[] = [];

    // Index POST endpoints that have no path params (collection-level)
    const posts = endpoints.filter(
      (e) => e.method === 'POST' && !e.path.includes('{'),
    );

    for (const post of posts) {
      const base = post.path.replace(/\/$/, '');   // e.g. /pets
      // Look for GET /base/{something} and DELETE /base/{something}
      const reads = endpoints.filter(
        (e) =>
          e.method === 'GET' &&
          new RegExp(`^${escapeRegex(base)}/\\{[^/]+\\}$`).test(e.path),
      );
      const deletes = endpoints.filter(
        (e) =>
          e.method === 'DELETE' &&
          new RegExp(`^${escapeRegex(base)}/\\{[^/]+\\}$`).test(e.path),
      );

      if (reads.length > 0 && deletes.length > 0) {
        flows.push({
          resource: base,
          create: post,
          read: reads[0],
          delete: deletes[0],
        });
      }
    }

    return flows;
  }

  // ── Chain execution ───────────────────────────────────────────────────────

  async runChains(
    endpoints: ParsedEndpoint[],
    baseUrl: string,
    dto: RunTestsDto,
    authHeaders: Record<string, string>,
    authQueryParams: Record<string, string>,
    onResult: (result: TestResult) => void,
  ): Promise<TestResult[]> {
    const flows = this.detectFlows(endpoints);
    if (flows.length === 0) return [];

    const allResults: TestResult[] = [];

    for (const flow of flows) {
      this.logger.log(`Running chain: POST ${flow.create.path} → GET → DELETE`);
      const results = await this.runSingleChain(flow, baseUrl, authHeaders, authQueryParams, onResult);
      allResults.push(...results);
    }

    return allResults;
  }

  private async runSingleChain(
    flow: ChainFlow,
    baseUrl: string,
    authHeaders: Record<string, string>,
    authQueryParams: Record<string, string>,
    onResult: (result: TestResult) => void,
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const vars: Record<string, string> = {};

    // ── Step 1: CREATE ──
    const createBody = this.buildSampleBody(flow.create);
    const createResult = await this.executeStep(
      'CREATE',
      flow.create.method,
      flow.create.path,
      baseUrl,
      authHeaders,
      authQueryParams,
      createBody,
      [200, 201],
      onResult,
    );
    results.push(createResult);

    // Extract id from response
    if (createResult.responseBody) {
      const extracted = this.extractVariables(createResult.responseBody, [
        { variable: 'id', jsonPath: 'id' },
        { variable: 'id', jsonPath: 'data.id' },
        { variable: 'id', jsonPath: '_id' },
        { variable: 'id', jsonPath: 'petId' },
        { variable: 'id', jsonPath: 'userId' },
        { variable: 'id', jsonPath: 'orderId' },
      ]);
      Object.assign(vars, extracted);
    }

    const idValue = vars['id'];
    const paramName = this.extractParamName(flow.read.path); // e.g. "petId"

    // ── Step 2: READ ──
    const readPath = idValue
      ? this.resolvePath(flow.read.path, paramName, idValue)
      : this.resolvePath(flow.read.path, paramName, '1');

    const readResult = await this.executeStep(
      'READ',
      flow.read.method,
      readPath,
      baseUrl,
      authHeaders,
      authQueryParams,
      undefined,
      [200, 201, 404], // 404 is ok if created resource isn't visible yet
      onResult,
    );
    results.push(readResult);

    // ── Step 3: DELETE (always attempt cleanup) ──
    const deletePath = idValue
      ? this.resolvePath(flow.delete.path, paramName, idValue)
      : this.resolvePath(flow.delete.path, paramName, '1');

    const deleteResult = await this.executeStep(
      'DELETE',
      flow.delete.method,
      deletePath,
      baseUrl,
      authHeaders,
      authQueryParams,
      undefined,
      [200, 201, 204, 404], // 404 means already gone — acceptable
      onResult,
    );
    results.push(deleteResult);

    return results;
  }

  private async executeStep(
    stepLabel: string,
    method: string,
    path: string,
    baseUrl: string,
    authHeaders: Record<string, string>,
    authQueryParams: Record<string, string>,
    body: any,
    expectedStatus: number[],
    onResult: (result: TestResult) => void,
  ): Promise<TestResult> {
    const cleanBase = baseUrl.replace(/\/$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const fullUrl = `${cleanBase}${cleanPath}`;
    const startTime = Date.now();

    // Add captured id to description for traceability
    const testName = `[CHAIN] ${method} ${path} — ${stepLabel}`;

    try {
      const response = await axios({
        method: method.toLowerCase() as any,
        url: fullUrl,
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        params: authQueryParams,
        data: body,
        timeout: 15000,
        validateStatus: () => true,
      });

      const passed = expectedStatus.includes(response.status);
      const result: TestResult = {
        testName,
        method,
        path,
        fullUrl,
        status: passed ? 'PASS' : 'FAIL',
        expected: expectedStatus,
        actual: response.status,
        responseTime: Date.now() - startTime,
        category: 'flow',
        description: `Chain step: ${stepLabel} for ${path}`,
        requestBody: body,
        responseBody: response.data,
        responseHeaders: this.normalizeHeaders(response.headers),
        isAiGenerated: false,
        timestamp: new Date().toISOString(),
        errorMessage: passed ? undefined : `Expected ${expectedStatus.join('/')} got ${response.status}`,
      };
      onResult(result);
      return result;
    } catch (err) {
      const result: TestResult = {
        testName,
        method,
        path,
        fullUrl,
        status: 'ERROR',
        expected: expectedStatus,
        actual: null,
        responseTime: Date.now() - startTime,
        category: 'flow',
        description: `Chain step: ${stepLabel} for ${path}`,
        requestBody: body,
        isAiGenerated: false,
        timestamp: new Date().toISOString(),
        errorMessage: err.message,
      };
      onResult(result);
      return result;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Extract variables from a JSON response object using dot-path rules */
  extractVariables(body: any, rules: ExtractRule[]): Record<string, string> {
    const vars: Record<string, string> = {};
    if (!body || typeof body !== 'object') return vars;

    for (const rule of rules) {
      if (vars[rule.variable]) continue; // already found
      const value = this.getByPath(body, rule.jsonPath);
      if (value !== undefined && value !== null) {
        vars[rule.variable] = String(value);
      }
    }
    return vars;
  }

  private getByPath(obj: any, path: string): any {
    return path.split('.').reduce((cur, key) => (cur != null ? cur[key] : undefined), obj);
  }

  private extractParamName(path: string): string {
    const match = path.match(/\{([^}]+)\}/);
    return match ? match[1] : 'id';
  }

  private resolvePath(path: string, paramName: string, value: string): string {
    return path.replace(`{${paramName}}`, value);
  }

  private buildSampleBody(endpoint: ParsedEndpoint): any {
    if (!endpoint.requestBody?.schema) return {};
    const schema = endpoint.requestBody.schema;
    const props = schema.properties || {};
    const body: Record<string, any> = {};
    for (const [key, val] of Object.entries(props as Record<string, any>)) {
      body[key] = this.sampleValue(val);
    }
    return body;
  }

  private sampleValue(schema: any): any {
    if (!schema) return 'test';
    if (schema.example !== undefined) return schema.example;
    switch (schema.type) {
      case 'integer':
      case 'number': return 1;
      case 'boolean': return true;
      case 'array': return [];
      case 'object': return {};
      default:
        if (schema.format === 'email') return 'test@example.com';
        return 'test_value';
    }
  }

  private normalizeHeaders(headers: Record<string, unknown>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      if (v != null) out[k] = Array.isArray(v) ? v.join(', ') : String(v);
    }
    return out;
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
