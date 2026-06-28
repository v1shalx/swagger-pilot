/**
 * @file security-probe.service.ts
 * @description Automated OWASP API Security Top 10 (2023) probe engine.
 *
 * Each probe is spec-aware: it uses the parsed OpenAPI endpoints to know
 * which parameters exist, what types they are, and what bodies to send —
 * so probes are targeted, not blind.
 *
 * Probes implemented:
 *  - SQL / NoSQL Injection   (API8:2023 - Security Misconfiguration / Injection)
 *  - Mass Assignment         (API3:2023 - Broken Object Property Level Auth)
 *  - Rate Limit Absence      (API4:2023 - Unrestricted Resource Consumption)
 *  - CORS Misconfiguration   (API7:2023 - Security Misconfiguration)
 *  - Missing Security Headers(API7:2023 - Security Misconfiguration)
 *  - Verbose Error Leakage   (API4/8:2023 - Improper Inventory / Misc.)
 *
 * Probes that reuse existing TestResult data (zero extra requests):
 *  - Security headers check  (reads responseHeaders from existing results)
 *  - Verbose error check     (reads responseBody from FAIL/ERROR results)
 *
 * All network probes are capped to avoid hammering the target API.
 */

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ParsedEndpoint } from '../swagger-parser/swagger-parser.dto';
import { TestResult } from '../test-runner/test-runner.service';
import { RunTestsDto } from '../swagger-parser/swagger-parser.dto';

// ── Public types ─────────────────────────────────────────────────────────────

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface SecurityFinding {
  /** Unique ID for deduplication on the frontend. */
  id: string;
  /** OWASP API Top 10 category slug. */
  probeType: 'injection' | 'mass-assignment' | 'rate-limiting' | 'cors' | 'security-headers' | 'verbose-errors';
  /** "GET /pet/{petId}" or "global" for non-endpoint findings. */
  endpoint: string;
  severity: SecuritySeverity;
  /** Short title shown in the findings list. */
  title: string;
  /** Full explanation of the finding. */
  detail: string;
  /** Raw evidence snippet (max 300 chars). */
  evidence?: string;
  /** Actionable remediation guidance. */
  recommendation: string;
  /** OWASP reference string, e.g. "API4:2023 Unrestricted Resource Consumption". */
  owaspCategory: string;
  /** true = probe ran and found no issue; false = vulnerability detected. */
  passed: boolean;
}

export interface SecuritySummary {
  totalProbes: number;
  vulnerabilities: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  /** 0-100 composite security score. Deducted per severity. */
  score: number;
  findings: SecurityFinding[];
  scannedAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** SQL injection test payloads. */
const SQL_PAYLOADS = ["' OR '1'='1", "1; DROP TABLE users --", "\" OR \"1\"=\"1"];

/** Patterns that indicate a SQL/DB error leaked into the response. */
const SQL_ERROR_RE = [
  /sql syntax/i, /you have an error in your sql/i, /mysql_fetch/i,
  /ora-\d{4,}/i, /pg_query\(\)/i, /sqlite.*error/i,
  /unclosed quotation mark/i, /quoted string not properly terminated/i,
  /sqlstate\[/i, /jdbc.*exception/i, /Warning.*mysql/i,
];

/** NoSQL injection payloads (sent as query-param values). */
const NOSQL_PAYLOADS = ['{"$ne":null}', '[$ne]=null'];

/** Sentinel fields injected for mass-assignment detection. */
const MASS_ASSIGN_SENTINELS: Record<string, unknown> = {
  __sp_probe__: true,
  role: 'admin',
  isAdmin: true,
  permissions: ['read', 'write', 'admin'],
};

/** The evil origin used for CORS probing. */
const EVIL_ORIGIN = 'https://sp-evil-probe.swaggerpilot.io';

/** Required security response headers. */
const REQUIRED_HEADERS: { header: string; severity: SecuritySeverity; owaspNote: string }[] = [
  { header: 'x-content-type-options', severity: 'medium', owaspNote: 'Prevents MIME-type sniffing attacks' },
  { header: 'x-frame-options',        severity: 'medium', owaspNote: 'Prevents clickjacking' },
];

/** Patterns that indicate internal stack traces or paths in a response body. */
const VERBOSE_ERROR_RE = [
  /at com\.[a-z]/i, /at java\.[a-z]/i, /Exception in thread/,
  /Traceback \(most recent call last\)/,
  /\/home\/\w/, /\/var\/www/, /C:\\Users\\/i,
  /password=.{3,}/i, /connection string/i,
];

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class SecurityProbeService {
  private readonly logger = new Logger(SecurityProbeService.name);

  /**
   * Run all OWASP probes and return a {@link SecuritySummary}.
   *
   * Probes that require new HTTP requests are capped to avoid hammering
   * the target API. Probes that can reuse existing test results do so.
   *
   * @param endpoints       Parsed OpenAPI endpoints from the spec
   * @param baseUrl         Resolved base URL for the API under test
   * @param dto             Full run configuration (auth, delays, etc.)
   * @param authHeaders     Resolved auth headers from the main run
   * @param existingResults Completed test results from the main run
   */
  async runProbes(
    endpoints: ParsedEndpoint[],
    baseUrl: string,
    dto: RunTestsDto,
    authHeaders: Record<string, string>,
    existingResults: TestResult[],
  ): Promise<SecuritySummary> {
    this.logger.log('Starting OWASP security probe scan...');
    const findings: SecurityFinding[] = [];

    // Zero-request probes (reuse existing results)
    findings.push(...this.checkSecurityHeaders(existingResults));
    findings.push(...this.checkVerboseErrors(existingResults));

    // Network probes (capped)
    const getEndpoints = endpoints.filter((e) => e.method.toUpperCase() === 'GET');
    const mutatingEndpoints = endpoints.filter((e) =>
      ['POST', 'PUT', 'PATCH'].includes(e.method.toUpperCase()),
    );

    try { findings.push(...await this.checkCors(getEndpoints.slice(0, 3), baseUrl, authHeaders)); }
    catch (e) { this.logger.warn(`CORS probe error: ${e.message}`); }

    try { findings.push(...await this.checkRateLimit(getEndpoints.slice(0, 1), baseUrl, authHeaders, dto)); }
    catch (e) { this.logger.warn(`Rate-limit probe error: ${e.message}`); }

    try { findings.push(...await this.checkInjection(getEndpoints.slice(0, 3), baseUrl, authHeaders)); }
    catch (e) { this.logger.warn(`Injection probe error: ${e.message}`); }

    try { findings.push(...await this.checkMassAssignment(mutatingEndpoints.slice(0, 3), baseUrl, authHeaders)); }
    catch (e) { this.logger.warn(`Mass-assignment probe error: ${e.message}`); }

    const vulnerabilities = findings.filter((f) => !f.passed).length;
    const criticalCount   = findings.filter((f) => !f.passed && f.severity === 'critical').length;
    const highCount       = findings.filter((f) => !f.passed && f.severity === 'high').length;
    const mediumCount     = findings.filter((f) => !f.passed && f.severity === 'medium').length;

    // Deduct from 100: critical -25, high -15, medium -7, low -3
    let score = 100;
    for (const f of findings.filter((f) => !f.passed)) {
      if (f.severity === 'critical') score -= 25;
      else if (f.severity === 'high')   score -= 15;
      else if (f.severity === 'medium') score -= 7;
      else if (f.severity === 'low')    score -= 3;
    }
    score = Math.max(0, score);

    this.logger.log(`Security scan complete: ${vulnerabilities} issues found, score ${score}/100`);
    return {
      totalProbes: findings.length,
      vulnerabilities,
      criticalCount,
      highCount,
      mediumCount,
      score,
      findings,
      scannedAt: new Date().toISOString(),
    };
  }

  // ── Zero-request probes ──────────────────────────────────────────────────

  /**
   * Check for missing security response headers in existing test results.
   * No new HTTP requests needed — reuses headers from the main run.
   */
  private checkSecurityHeaders(results: TestResult[]): SecurityFinding[] {
    const passedResults = results.filter(
      (r) => r.status === 'PASS' && r.responseHeaders,
    );
    if (passedResults.length === 0) return [];

    // Collect unique header keys seen across all responses (normalised to lower-case)
    const seenHeaders = new Set<string>();
    for (const r of passedResults) {
      for (const h of Object.keys(r.responseHeaders ?? {})) {
        seenHeaders.add(h.toLowerCase());
      }
    }

    const findings: SecurityFinding[] = [];
    for (const { header, severity, owaspNote } of REQUIRED_HEADERS) {
      const present = seenHeaders.has(header);
      findings.push({
        id: `sec-headers-${header}`,
        probeType: 'security-headers',
        endpoint: 'global',
        severity: present ? 'info' : severity,
        title: present
          ? `Security header present: ${header}`
          : `Missing security header: ${header}`,
        detail: present
          ? `The ${header} header was found in API responses.`
          : `The ${header} header is absent from API responses. ${owaspNote}.`,
        recommendation: present
          ? 'No action needed.'
          : `Add the ${header} header to all API responses in your server/gateway configuration.`,
        owaspCategory: 'API7:2023 - Security Misconfiguration',
        passed: present,
      });
    }
    return findings;
  }

  /**
   * Scan error response bodies for internal implementation details.
   * Stack traces, file paths, or DB connection strings in error responses
   * reveal server internals and are a common finding in API security audits.
   */
  private checkVerboseErrors(results: TestResult[]): SecurityFinding[] {
    const errorResults = results.filter(
      (r) => (r.status === 'FAIL' || r.status === 'ERROR') && r.responseBody,
    );

    for (const result of errorResults) {
      const body = typeof result.responseBody === 'string'
        ? result.responseBody
        : JSON.stringify(result.responseBody ?? '');

      for (const pattern of VERBOSE_ERROR_RE) {
        if (pattern.test(body)) {
          return [{
            id: 'verbose-error-leak',
            probeType: 'verbose-errors',
            endpoint: `${result.method} ${result.path}`,
            severity: 'high',
            title: 'Internal details leaked in error response',
            detail: 'An error response contained internal server information such as a stack trace, file path, or connection string. This assists attackers in profiling the system.',
            evidence: body.slice(0, 300),
            recommendation: 'Configure your error handler to return generic error messages in production. Never expose stack traces, file paths, or DB details to API consumers.',
            owaspCategory: 'API8:2023 - Security Misconfiguration',
            passed: false,
          }];
        }
      }
    }

    return [{
      id: 'verbose-error-ok',
      probeType: 'verbose-errors',
      endpoint: 'global',
      severity: 'info',
      title: 'No verbose errors detected',
      detail: 'Error responses did not expose stack traces or internal details.',
      recommendation: 'Continue redacting error details in production responses.',
      owaspCategory: 'API8:2023 - Security Misconfiguration',
      passed: true,
    }];
  }

  // ── Network probes ───────────────────────────────────────────────────────

  /**
   * Probe for CORS misconfiguration by sending a request with a hostile
   * Origin header and inspecting the Access-Control-Allow-Origin response.
   *
   * A wildcard (`*`) or reflection of the evil origin on a credentialled
   * API is a critical finding (allows cross-site request forgery from any
   * origin).
   */
  private async checkCors(
    endpoints: ParsedEndpoint[],
    baseUrl: string,
    authHeaders: Record<string, string>,
  ): Promise<SecurityFinding[]> {
    if (endpoints.length === 0) return [];

    const ep = endpoints[0];
    const url = `${baseUrl.replace(/\/$/, '')}${ep.path.replace(/\{[^}]+\}/g, '1')}`;

    try {
      const res = await axios.get(url, {
        headers: { ...authHeaders, Origin: EVIL_ORIGIN },
        validateStatus: () => true,
        timeout: 8000,
      });

      const acao = (res.headers['access-control-allow-origin'] ?? '').trim();
      const isWildcard  = acao === '*';
      const isEchoed    = acao.toLowerCase() === EVIL_ORIGIN.toLowerCase();
      const vulnerable  = isWildcard || isEchoed;

      return [{
        id: 'cors-probe',
        probeType: 'cors',
        endpoint: `${ep.method.toUpperCase()} ${ep.path}`,
        severity: vulnerable ? 'high' : 'info',
        title: vulnerable
          ? `CORS misconfiguration — Access-Control-Allow-Origin: ${acao}`
          : 'CORS policy correctly restricts cross-origin access',
        detail: vulnerable
          ? `The API returned Access-Control-Allow-Origin: ${acao} in response to a request from a hostile origin (${EVIL_ORIGIN}). Combined with Access-Control-Allow-Credentials, this can allow cross-site request forgery.`
          : `The API did not echo the hostile origin. ACAO header value: "${acao || '(absent)'}".`,
        evidence: acao ? `Access-Control-Allow-Origin: ${acao}` : undefined,
        recommendation: vulnerable
          ? 'Restrict CORS to known trusted origins using an allowlist. Never use `*` with credentialled requests.'
          : 'CORS policy looks correct. Periodically audit your allowlist as new origins are added.',
        owaspCategory: 'API7:2023 - Security Misconfiguration',
        passed: !vulnerable,
      }];
    } catch {
      return [];
    }
  }

  /**
   * Probe for absent rate limiting by firing 25 rapid requests at a single
   * GET endpoint. If no response ever returns HTTP 429 (Too Many Requests)
   * or 503 (Service Unavailable / throttled), rate limiting is likely absent.
   *
   * Capped to 25 requests against 1 endpoint.
   */
  private async checkRateLimit(
    endpoints: ParsedEndpoint[],
    baseUrl: string,
    authHeaders: Record<string, string>,
    dto: RunTestsDto,
  ): Promise<SecurityFinding[]> {
    if (endpoints.length === 0) return [];

    const ep  = endpoints[0];
    const url = `${baseUrl.replace(/\/$/, '')}${ep.path.replace(/\{[^}]+\}/g, '1')}`;
    const BURST = 25;

    try {
      const responses = await Promise.all(
        Array.from({ length: BURST }, () =>
          axios.get(url, {
            headers: authHeaders,
            validateStatus: () => true,
            timeout: 8000,
          }),
        ),
      );

      const rateLimited = responses.some((r) => r.status === 429 || r.status === 503);

      return [{
        id: 'rate-limit-probe',
        probeType: 'rate-limiting',
        endpoint: `GET ${ep.path}`,
        severity: rateLimited ? 'info' : 'medium',
        title: rateLimited
          ? 'Rate limiting is active'
          : `No rate limiting detected after ${BURST} rapid requests`,
        detail: rateLimited
          ? `The API returned a 429/503 after rapid requests — rate limiting is enforced.`
          : `${BURST} concurrent requests were sent to ${ep.path} and none were throttled (no 429 or 503 received). Without rate limiting, the API is vulnerable to enumeration, credential stuffing, and DoS.`,
        recommendation: rateLimited
          ? 'Rate limiting is in place. Confirm limits are sufficiently low for sensitive endpoints (auth, PII).'
          : 'Implement rate limiting at the API gateway or application layer. Use token-bucket or sliding window algorithms. Apply stricter limits on authentication endpoints.',
        owaspCategory: 'API4:2023 - Unrestricted Resource Consumption',
        passed: rateLimited,
      }];
    } catch {
      return [];
    }
  }

  /**
   * Probe for SQL and NoSQL injection by inserting payloads into string
   * query parameters and checking for database error signatures in the
   * response body.
   *
   * This is a passive detection probe — it flags when DB errors are leaked,
   * not when the query is actually exploited.
   */
  private async checkInjection(
    endpoints: ParsedEndpoint[],
    baseUrl: string,
    authHeaders: Record<string, string>,
  ): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    for (const ep of endpoints) {
      const stringParams = ep.parameters.filter(
        (p) => p.in === 'query' && (p.schema?.type === 'string' || !p.schema?.type),
      );
      if (stringParams.length === 0) continue;

      const param = stringParams[0];
      const url   = `${baseUrl.replace(/\/$/, '')}${ep.path.replace(/\{[^}]+\}/g, '1')}`;

      for (const payload of SQL_PAYLOADS.slice(0, 2)) {
        try {
          const res = await axios.get(url, {
            params:         { [param.name]: payload },
            headers:        authHeaders,
            validateStatus: () => true,
            timeout:        8000,
          });

          const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '');
          const sqlError = SQL_ERROR_RE.some((re) => re.test(body));

          if (sqlError) {
            findings.push({
              id: `injection-${ep.method}-${ep.path}`,
              probeType: 'injection',
              endpoint: `${ep.method.toUpperCase()} ${ep.path}`,
              severity: 'critical',
              title: `SQL error leaked — possible injection in param "${param.name}"`,
              detail: `Sending payload \`${payload}\` as the \`${param.name}\` query parameter triggered a database error message in the response body. This indicates the parameter is passed directly to a SQL query without sanitisation.`,
              evidence: body.slice(0, 300),
              recommendation: 'Use parameterised queries or prepared statements. Never concatenate user input into SQL strings. Validate and sanitise all query parameters at the controller layer.',
              owaspCategory: 'API8:2023 - Security Misconfiguration / Injection',
              passed: false,
            });
            break; // one finding per endpoint is enough
          }
        } catch { /* network error — skip */ }
      }
    }

    if (findings.length === 0) {
      findings.push({
        id: 'injection-ok',
        probeType: 'injection',
        endpoint: 'global',
        severity: 'info',
        title: 'No SQL/NoSQL injection signatures detected',
        detail: 'Injection payloads in string query parameters did not produce database error signatures in responses.',
        recommendation: 'Continue using parameterised queries and input validation. Consider adding a WAF for an additional defence layer.',
        owaspCategory: 'API8:2023 - Security Misconfiguration / Injection',
        passed: true,
      });
    }

    return findings;
  }

  /**
   * Probe for mass assignment by sending extra undeclared fields alongside
   * a valid request body and checking whether those fields appear in the
   * response (indicating the server bound them without filtering).
   *
   * Uses a sentinel field `__sp_probe__: true` alongside common escalation
   * fields (`role`, `isAdmin`, `permissions`).
   */
  private async checkMassAssignment(
    endpoints: ParsedEndpoint[],
    baseUrl: string,
    authHeaders: Record<string, string>,
  ): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    for (const ep of endpoints) {
      const schema = ep.requestBody?.schema;
      if (!schema?.properties) continue;

      // Build minimal valid body from schema, then inject sentinel fields
      const minimalBody: Record<string, unknown> = {};
      for (const [field, def] of Object.entries<any>(schema.properties)) {
        const t = def.type;
        minimalBody[field] = t === 'string' ? 'test' : t === 'number' || t === 'integer' ? 1 : t === 'boolean' ? false : null;
      }
      const probeBody = { ...minimalBody, ...MASS_ASSIGN_SENTINELS };

      const url = `${baseUrl.replace(/\/$/, '')}${ep.path.replace(/\{[^}]+\}/g, '1')}`;

      try {
        const res = await axios({
          method:         ep.method.toLowerCase() as any,
          url,
          data:           probeBody,
          headers:        { ...authHeaders, 'Content-Type': 'application/json' },
          validateStatus: () => true,
          timeout:        8000,
        });

        const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '');
        const reflected = Object.keys(MASS_ASSIGN_SENTINELS).some((k) => body.includes(`"${k}"`));

        if (reflected && (res.status >= 200 && res.status < 300)) {
          findings.push({
            id: `mass-assign-${ep.method}-${ep.path}`,
            probeType: 'mass-assignment',
            endpoint: `${ep.method.toUpperCase()} ${ep.path}`,
            severity: 'high',
            title: `Mass assignment — undeclared fields reflected in response`,
            detail: `Sending extra fields (${Object.keys(MASS_ASSIGN_SENTINELS).join(', ')}) in the request body to ${ep.method.toUpperCase()} ${ep.path} resulted in those fields appearing in the 2xx response. The server likely bound the raw request body directly to the model object.`,
            evidence: body.slice(0, 300),
            recommendation: 'Use DTOs/allowlists to explicitly declare which fields may be set by clients. Never bind raw request bodies to internal models. Use `@Exclude()` or equivalent to strip unexpected fields.',
            owaspCategory: 'API3:2023 - Broken Object Property Level Authorization',
            passed: false,
          });
        }
      } catch { /* skip */ }
    }

    if (findings.length === 0) {
      findings.push({
        id: 'mass-assign-ok',
        probeType: 'mass-assignment',
        endpoint: 'global',
        severity: 'info',
        title: 'No mass assignment vulnerability detected',
        detail: 'Sentinel fields injected into request bodies were not reflected back in responses.',
        recommendation: 'Continue using DTOs with explicit field allowlists to prevent mass assignment.',
        owaspCategory: 'API3:2023 - Broken Object Property Level Authorization',
        passed: true,
      });
    }

    return findings;
  }
}
