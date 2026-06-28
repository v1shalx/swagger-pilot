/**
 * Feature 3 — Authorization / IDOR Testing
 *
 * For each ID-based resource endpoint (GET /resource/{id}, PUT /resource/{id},
 * DELETE /resource/{id}), we make the request using USER B's auth headers
 * but with a resource belonging to USER A (captured from a prior POST by user A).
 *
 * If the response is 2xx instead of 403/404 → flag as IDOR / authorization_leak.
 */
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ParsedEndpoint, RunTestsDto } from '../swagger-parser/swagger-parser.dto';
import { TestResult } from './test-runner.service';

export interface IdorFinding {
  method: string;
  path: string;
  resolvedPath: string;
  actualStatus: number;
  message: string;
}

@Injectable()
export class IdorCheckerService {
  private readonly logger = new Logger(IdorCheckerService.name);

  /**
   * Runs IDOR (Insecure Direct Object Reference) checks across all endpoints.
   *
   * Strategy:
   *  1. User A creates a resource via POST (or uses a known ID)
   *  2. User B attempts GET, PUT, and DELETE on that resource
   *  3. If User B receives 200/201/204, an authorisation leak is flagged
   *
   * Results are emitted via `onResult` and also returned as an array.
   *
   * @param endpoints       - All parsed endpoints from the spec
   * @param baseUrl         - The API base URL
   * @param authHeadersA    - Auth headers for User A (resource owner)
   * @param authHeadersB    - Auth headers for User B (should be denied)
   * @param dto             - Run configuration
   * @param onResult        - Live result callback
   * @returns All IDOR check results
   */
  async runIdorChecks(
    endpoints: ParsedEndpoint[],
    baseUrl: string,
    userAHeaders: Record<string, string>,
    userBHeaders: Record<string, string>,
    dto: RunTestsDto,
    onResult: (result: TestResult) => void,
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Find all POST endpoints without path params (resource creation)
    const postEndpoints = endpoints.filter(
      (e) => e.method === 'POST' && !e.path.includes('{'),
    );

    for (const post of postEndpoints) {
      const base = post.path.replace(/\/$/, '');

      // Find corresponding ID-based endpoints
      const idEndpoints = endpoints.filter((e) =>
        ['GET', 'PUT', 'PATCH', 'DELETE'].includes(e.method) &&
        new RegExp(`^${escapeRegex(base)}/\\{[^/]+\\}$`).test(e.path),
      );
      if (idEndpoints.length === 0) continue;

      // Step 1: Create a resource as User A
      const createBody = this.buildSampleBody(post);
      let createdId: string | null = null;

      try {
        const createRes = await axios({
          method: 'post',
          url: `${baseUrl.replace(/\/$/, '')}${base}`,
          headers: { 'Content-Type': 'application/json', ...userAHeaders },
          data: createBody,
          timeout: 10000,
          validateStatus: () => true,
        });

        if (createRes.status >= 200 && createRes.status < 300) {
          createdId = this.extractId(createRes.data);
        }
      } catch (err) {
        this.logger.warn(`IDOR create step failed for ${base}: ${err.message}`);
        continue;
      }

      if (!createdId) {
        this.logger.warn(`Could not extract ID from CREATE response for ${base} — skipping IDOR`);
        continue;
      }

      // Step 2: Attempt to access user A's resource as User B
      for (const ep of idEndpoints) {
        const paramName = this.extractParamName(ep.path);
        const resolvedPath = ep.path.replace(`{${paramName}}`, createdId);
        const fullUrl = `${baseUrl.replace(/\/$/, '')}${resolvedPath}`;
        const startTime = Date.now();

        try {
          const res = await axios({
            method: ep.method.toLowerCase() as any,
            url: fullUrl,
            headers: { 'Content-Type': 'application/json', ...userBHeaders },
            timeout: 10000,
            validateStatus: () => true,
          });

          const isLeak = res.status >= 200 && res.status < 300;
          const testResult: TestResult = {
            testName: `[IDOR] ${ep.method} ${resolvedPath} — User B accessing User A resource`,
            method: ep.method,
            path: resolvedPath,
            fullUrl,
            status: isLeak ? 'FAIL' : 'PASS',
            expected: [403, 404],
            actual: res.status,
            responseTime: Date.now() - startTime,
            category: 'authorization_leak',
            description: `IDOR check: User B (different identity) attempting to access User A's resource at ${resolvedPath}. Expected 403 or 404.`,
            responseBody: isLeak ? res.data : undefined,
            responseHeaders: this.normalizeHeaders(res.headers),
            isAiGenerated: false,
            timestamp: new Date().toISOString(),
            errorMessage: isLeak
              ? `🚨 CRITICAL: Broken Object Level Authorization (IDOR) — ${ep.method} ${resolvedPath} returned ${res.status} when accessed by a different user. Resource should be protected.`
              : undefined,
          };

          onResult(testResult);
          results.push(testResult);

          if (isLeak) {
            this.logger.warn(
              `IDOR LEAK: ${ep.method} ${resolvedPath} returned ${res.status} for User B`,
            );
          }
        } catch (err) {
          const testResult: TestResult = {
            testName: `[IDOR] ${ep.method} ${resolvedPath} — User B accessing User A resource`,
            method: ep.method,
            path: resolvedPath,
            fullUrl,
            status: 'ERROR',
            expected: [403, 404],
            actual: null,
            responseTime: Date.now() - startTime,
            category: 'authorization_leak',
            description: `IDOR check failed with error`,
            isAiGenerated: false,
            timestamp: new Date().toISOString(),
            errorMessage: err.message,
          };
          onResult(testResult);
          results.push(testResult);
        }
      }

      // Cleanup: delete the resource as User A
      const deleteEp = endpoints.find(
        (e) =>
          e.method === 'DELETE' &&
          new RegExp(`^${escapeRegex(base)}/\\{[^/]+\\}$`).test(e.path),
      );
      if (deleteEp && createdId) {
        const paramName = this.extractParamName(deleteEp.path);
        const deletePath = deleteEp.path.replace(`{${paramName}}`, createdId);
        try {
          await axios({
            method: 'delete',
            url: `${baseUrl.replace(/\/$/, '')}${deletePath}`,
            headers: { ...userAHeaders },
            timeout: 10000,
            validateStatus: () => true,
          });
        } catch (_) {
          // best-effort cleanup
        }
      }
    }

    return results;
  }

  private extractId(body: any): string | null {
    if (!body || typeof body !== 'object') return null;
    const candidates = ['id', '_id', 'petId', 'userId', 'orderId', 'uuid'];
    for (const key of candidates) {
      if (body[key] !== undefined && body[key] !== null) return String(body[key]);
    }
    if (body.data) return this.extractId(body.data);
    return null;
  }

  private extractParamName(path: string): string {
    const match = path.match(/\{([^}]+)\}/);
    return match ? match[1] : 'id';
  }

  private buildSampleBody(endpoint: ParsedEndpoint): any {
    if (!endpoint.requestBody?.schema) return {};
    const props = endpoint.requestBody.schema.properties || {};
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
      default:
        if (schema.format === 'email') return 'idor_test@example.com';
        return 'idor_test_value';
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
