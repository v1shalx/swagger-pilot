/**
 * @file rule-engine.service.ts
 * @description Deterministic test case generator.
 *
 * Applies a fixed set of QA rules to each parsed endpoint to produce
 * {@link GeneratedTest} objects without any network calls or AI involvement.
 *
 * Rules implemented (in order of execution):
 *  1. Auth tests     — missing token → 401, invalid token → 401
 *  2. Path params    — non-existent ID, string for numeric, negative, zero
 *  3. Query params   — missing required parameters → 400
 *  4. Body tests     — empty body, missing required fields, wrong types
 *  5. Boundary tests — below minimum, above maximum, short/long strings, bad enum
 *  6. Format tests   — invalid email/uuid/date/uri values
 *  7. Happy path     — valid request with all correct values → 2xx
 */
import { Injectable, Logger } from '@nestjs/common';
import { ParsedEndpoint } from '../swagger-parser/swagger-parser.dto';

/** Represents a single generated test case ready for execution. */
export interface GeneratedTest {
  testName: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  queryParams: Record<string, any>;
  body: any;
  expectedStatus: number[];
  category: string;
  description: string;
  isSkipped?: boolean;
  skipReason?: string;
}

@Injectable()
export class RuleEngineService {
  private readonly logger = new Logger(RuleEngineService.name);

  /**
   * Entry point — generates all test cases for a single endpoint.
   *
   * Multipart/file-upload endpoints are returned as a single SKIPPED test
   * because automated file uploads require binary fixtures.
   *
   * @param endpoint - The parsed OpenAPI endpoint definition
   * @param hasAuth  - Whether the user provided valid auth credentials for this run
   * @returns Array of generated test cases (may include skipped entries)
   */
  generateTests(endpoint: ParsedEndpoint, hasAuth: boolean): GeneratedTest[] {
    const tests: GeneratedTest[] = [];
    const isSecured = endpoint.security && endpoint.security.length > 0;

    // Skip multipart endpoints — mark as skipped with reason
    if (endpoint.requestBody?.isMultipart) {
      tests.push({
        testName: `${endpoint.method} ${endpoint.path} — SKIPPED (multipart/file upload)`,
        method: endpoint.method,
        path: endpoint.path,
        headers: {},
        queryParams: {},
        body: null,
        expectedStatus: [],
        category: 'skipped',
        description: 'Multipart/form-data endpoints require file uploads and are skipped.',
        isSkipped: true,
        skipReason: 'multipart/form-data endpoints are not supported for automated testing',
      });
      return tests;
    }

    // 1. AUTH TESTS
    if (isSecured) {
      tests.push(...this.generateAuthTests(endpoint, hasAuth));
    }

    // 2. PATH PARAMETER TESTS
    const pathParams = endpoint.parameters.filter((p) => p.in === 'path');
    if (pathParams.length > 0) {
      tests.push(...this.generatePathParamTests(endpoint));
    }

    // 3. QUERY PARAMETER TESTS
    const queryParams = endpoint.parameters.filter((p) => p.in === 'query');
    if (queryParams.length > 0) {
      tests.push(...this.generateQueryParamTests(endpoint, queryParams));
    }

    // 4. REQUEST BODY TESTS (POST/PUT/PATCH)
    if (endpoint.requestBody && ['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
      tests.push(...this.generateBodyTests(endpoint));
    }

    // 5. HAPPY PATH TEST (valid request)
    tests.push(this.generateHappyPathTest(endpoint));

    return tests;
  }

  // ─── AUTH TESTS ───────────────────────────────────────────────────────────

  /**
   * Generates authentication failure tests for secured endpoints.
   *
   * Tests:
   *  - No Authorization header → expects 401 or 403
   *  - Invalid Bearer token    → expects 401 or 403
   *
   * @param endpoint - The secured endpoint to test
   * @param hasAuth  - Whether valid credentials are available (not used here — we intentionally omit/corrupt them)
   */
  private generateAuthTests(endpoint: ParsedEndpoint, hasAuth: boolean): GeneratedTest[] {
    const tests: GeneratedTest[] = [];

    // No auth header → expect 401
    tests.push({
      testName: `${endpoint.method} ${endpoint.path} — No auth token`,
      method: endpoint.method,
      path: this.buildPathWithSampleValues(endpoint),
      headers: {},
      queryParams: this.buildSampleQueryParams(endpoint),
      body: this.buildValidBody(endpoint),
      expectedStatus: [401, 403],
      category: 'auth',
      description: 'Request without any authentication should return 401 or 403',
    });

    // Invalid auth token → expect 401
    tests.push({
      testName: `${endpoint.method} ${endpoint.path} — Invalid auth token`,
      method: endpoint.method,
      path: this.buildPathWithSampleValues(endpoint),
      headers: { Authorization: 'Bearer invalid_token_abc123xyz' },
      queryParams: this.buildSampleQueryParams(endpoint),
      body: this.buildValidBody(endpoint),
      expectedStatus: [401, 403],
      category: 'auth',
      description: 'Request with invalid token should return 401 or 403',
    });

    return tests;
  }

  // ─── PATH PARAM TESTS ─────────────────────────────────────────────────────

  /**
   * Generates path parameter boundary and type tests.
   *
   * For integer/number path params (e.g. `{petId}`):
   *  - Non-existent ID (99999999)       → expects 404
   *  - String instead of number         → expects 400/422
   *  - Negative value (-1)              → expects 400/404
   *  - Zero (0)                         → expects 400/404
   *
   * For UUID string path params:
   *  - Malformed UUID string            → expects 400/404
   *
   * @param endpoint - The endpoint with path parameters to test
   */
  private generatePathParamTests(endpoint: ParsedEndpoint): GeneratedTest[] {
    const tests: GeneratedTest[] = [];
    const pathParams = endpoint.parameters.filter((p) => p.in === 'path');

    for (const param of pathParams) {
      const paramType = param.schema?.type || 'string';

      if (paramType === 'integer' || paramType === 'number') {
        // Non-existent ID
        tests.push({
          testName: `${endpoint.method} ${endpoint.path} — Non-existent ${param.name} (99999999)`,
          method: endpoint.method,
          path: this.buildPathWithValue(endpoint, param.name, '99999999'),
          headers: {},
          queryParams: this.buildSampleQueryParams(endpoint),
          body: this.buildValidBody(endpoint),
          expectedStatus: [404, 400],
          category: 'path-param',
          description: `Non-existent ${param.name} should return 404`,
        });

        // String instead of number
        tests.push({
          testName: `${endpoint.method} ${endpoint.path} — String for numeric ${param.name}`,
          method: endpoint.method,
          path: this.buildPathWithValue(endpoint, param.name, 'not-a-number'),
          headers: {},
          queryParams: this.buildSampleQueryParams(endpoint),
          body: this.buildValidBody(endpoint),
          expectedStatus: [400, 404, 422],
          category: 'path-param',
          description: `String value for numeric ${param.name} should return 400`,
        });

        // Negative ID
        tests.push({
          testName: `${endpoint.method} ${endpoint.path} — Negative ${param.name}`,
          method: endpoint.method,
          path: this.buildPathWithValue(endpoint, param.name, '-1'),
          headers: {},
          queryParams: this.buildSampleQueryParams(endpoint),
          body: this.buildValidBody(endpoint),
          expectedStatus: [400, 404, 422],
          category: 'path-param',
          description: `Negative ${param.name} should return 400 or 404`,
        });

        // Zero ID
        tests.push({
          testName: `${endpoint.method} ${endpoint.path} — Zero ${param.name}`,
          method: endpoint.method,
          path: this.buildPathWithValue(endpoint, param.name, '0'),
          headers: {},
          queryParams: this.buildSampleQueryParams(endpoint),
          body: this.buildValidBody(endpoint),
          expectedStatus: [400, 404, 422],
          category: 'path-param',
          description: `Zero ${param.name} should return 400 or 404`,
        });
      }

      if (paramType === 'string' && param.schema?.format === 'uuid') {
        tests.push({
          testName: `${endpoint.method} ${endpoint.path} — Invalid UUID for ${param.name}`,
          method: endpoint.method,
          path: this.buildPathWithValue(endpoint, param.name, 'not-a-uuid'),
          headers: {},
          queryParams: this.buildSampleQueryParams(endpoint),
          body: this.buildValidBody(endpoint),
          expectedStatus: [400, 404, 422],
          category: 'path-param',
          description: `Invalid UUID for ${param.name} should return 400`,
        });
      }
    }

    return tests;
  }

  // ─── QUERY PARAM TESTS ────────────────────────────────────────────────────

  /**
   * Generates missing required query parameter tests.
   *
   * For each query parameter marked `required: true` in the spec, creates a
   * test that omits only that parameter (keeping all others) and expects 400.
   *
   * @param endpoint    - The endpoint definition
   * @param queryParams - All query parameters parsed from the spec
   */
  private generateQueryParamTests(endpoint: ParsedEndpoint, queryParams: any[]): GeneratedTest[] {
    const tests: GeneratedTest[] = [];

    for (const param of queryParams) {
      if (!param.required) continue;

      const otherParams = queryParams.filter((p) => p.name !== param.name);
      const queryWithoutParam: Record<string, any> = {};
      for (const other of otherParams) {
        queryWithoutParam[other.name] = this.getSampleValue(other.schema);
      }

      tests.push({
        testName: `${endpoint.method} ${endpoint.path} — Missing required query param: ${param.name}`,
        method: endpoint.method,
        path: this.buildPathWithSampleValues(endpoint),
        headers: {},
        queryParams: queryWithoutParam,
        body: this.buildValidBody(endpoint),
        expectedStatus: [400, 422],
        category: 'query-param',
        description: `Missing required query param ${param.name} should return 400`,
      });
    }

    return tests;
  }

  // ─── BODY TESTS ───────────────────────────────────────────────────────────

  /**
   * Generates request body validation tests for POST/PUT/PATCH endpoints.
   *
   * Tests generated:
   *  - Empty body `{}`                           → expects 400
   *  - Each required field omitted one at a time → expects 400
   *  - Each field with wrong type value          → expects 400
   *  - Boundary value tests per field            → expects 400
   *  - Format validation tests per field         → expects 400
   *
   * @param endpoint - The endpoint with a request body schema
   */
  private generateBodyTests(endpoint: ParsedEndpoint): GeneratedTest[] {
    const tests: GeneratedTest[] = [];
    const schema = endpoint.requestBody?.schema;
    if (!schema) return tests;

    const resolvedSchema = this.resolveSchemaForTests(schema);
    const properties = resolvedSchema.properties || {};
    const required: string[] = resolvedSchema.required || [];

    // Empty body
    tests.push({
      testName: `${endpoint.method} ${endpoint.path} — Empty body`,
      method: endpoint.method,
      path: this.buildPathWithSampleValues(endpoint),
      headers: { 'Content-Type': 'application/json' },
      queryParams: this.buildSampleQueryParams(endpoint),
      body: {},
      expectedStatus: [400, 422],
      category: 'body',
      description: 'Empty body should return 400',
    });

    // Missing each required field
    for (const fieldName of required) {
      const bodyWithoutField = this.buildValidBodyFromSchema(resolvedSchema);
      delete bodyWithoutField[fieldName];

      tests.push({
        testName: `${endpoint.method} ${endpoint.path} — Missing required field: ${fieldName}`,
        method: endpoint.method,
        path: this.buildPathWithSampleValues(endpoint),
        headers: { 'Content-Type': 'application/json' },
        queryParams: this.buildSampleQueryParams(endpoint),
        body: bodyWithoutField,
        expectedStatus: [400, 422],
        category: 'required-field',
        description: `Missing required field ${fieldName} should return 400`,
      });
    }

    // Wrong types for each field
    for (const [fieldName, fieldSchema] of Object.entries(properties)) {
      const fs = fieldSchema as any;
      const wrongTypeBody = this.buildValidBodyFromSchema(resolvedSchema);
      const wrongValue = this.getWrongTypeValue(fs);

      if (wrongValue !== undefined) {
        wrongTypeBody[fieldName] = wrongValue;
        tests.push({
          testName: `${endpoint.method} ${endpoint.path} — Wrong type for ${fieldName}: ${JSON.stringify(wrongValue)}`,
          method: endpoint.method,
          path: this.buildPathWithSampleValues(endpoint),
          headers: { 'Content-Type': 'application/json' },
          queryParams: this.buildSampleQueryParams(endpoint),
          body: wrongTypeBody,
          expectedStatus: [400, 422],
          category: 'type-validation',
          description: `Wrong type for ${fieldName} should return 400`,
        });
      }

      // Boundary tests per field
      tests.push(...this.generateBoundaryTests(endpoint, fieldName, fs, resolvedSchema));

      // Format tests per field
      tests.push(...this.generateFormatTests(endpoint, fieldName, fs, resolvedSchema));
    }

    return tests;
  }

  // ─── BOUNDARY TESTS ───────────────────────────────────────────────────────

  /**
   * Generates boundary value tests for a single schema field.
   *
   * Numeric fields: tests values one below `minimum` and one above `maximum`.
   * String fields:  tests strings one char shorter than `minLength` and one
   *                 char longer than `maxLength`, plus invalid enum values.
   *
   * @param endpoint    - The parent endpoint (for test name and path building)
   * @param fieldName   - Name of the field being tested
   * @param fieldSchema - OpenAPI schema for this field
   * @param fullSchema  - The complete request body schema (to build valid base body)
   */
  private generateBoundaryTests(
    endpoint: ParsedEndpoint,
    fieldName: string,
    fieldSchema: any,
    fullSchema: any,
  ): GeneratedTest[] {
    const tests: GeneratedTest[] = [];
    const type = fieldSchema.type;

    if (type === 'integer' || type === 'number') {
      if (fieldSchema.minimum !== undefined) {
        const below = fieldSchema.minimum - 1;
        const body = this.buildValidBodyFromSchema(fullSchema);
        body[fieldName] = below;
        tests.push({
          testName: `${endpoint.method} ${endpoint.path} — ${fieldName} below minimum (${below})`,
          method: endpoint.method,
          path: this.buildPathWithSampleValues(endpoint),
          headers: { 'Content-Type': 'application/json' },
          queryParams: this.buildSampleQueryParams(endpoint),
          body,
          expectedStatus: [400, 422],
          category: 'boundary',
          description: `${fieldName} = ${below} (below minimum ${fieldSchema.minimum}) should return 400`,
        });
      }

      if (fieldSchema.maximum !== undefined) {
        const above = fieldSchema.maximum + 1;
        const body = this.buildValidBodyFromSchema(fullSchema);
        body[fieldName] = above;
        tests.push({
          testName: `${endpoint.method} ${endpoint.path} — ${fieldName} above maximum (${above})`,
          method: endpoint.method,
          path: this.buildPathWithSampleValues(endpoint),
          headers: { 'Content-Type': 'application/json' },
          queryParams: this.buildSampleQueryParams(endpoint),
          body,
          expectedStatus: [400, 422],
          category: 'boundary',
          description: `${fieldName} = ${above} (above maximum ${fieldSchema.maximum}) should return 400`,
        });
      }
    }

    if (type === 'string') {
      if (fieldSchema.minLength !== undefined && fieldSchema.minLength > 0) {
        const tooShort = 'a'.repeat(Math.max(0, fieldSchema.minLength - 1));
        const body = this.buildValidBodyFromSchema(fullSchema);
        body[fieldName] = tooShort;
        tests.push({
          testName: `${endpoint.method} ${endpoint.path} — ${fieldName} too short (${tooShort.length} chars)`,
          method: endpoint.method,
          path: this.buildPathWithSampleValues(endpoint),
          headers: { 'Content-Type': 'application/json' },
          queryParams: this.buildSampleQueryParams(endpoint),
          body,
          expectedStatus: [400, 422],
          category: 'boundary',
          description: `${fieldName} with ${tooShort.length} chars (below minLength ${fieldSchema.minLength}) should return 400`,
        });
      }

      if (fieldSchema.maxLength !== undefined) {
        const tooLong = 'a'.repeat(fieldSchema.maxLength + 1);
        const body = this.buildValidBodyFromSchema(fullSchema);
        body[fieldName] = tooLong;
        tests.push({
          testName: `${endpoint.method} ${endpoint.path} — ${fieldName} too long (${tooLong.length} chars)`,
          method: endpoint.method,
          path: this.buildPathWithSampleValues(endpoint),
          headers: { 'Content-Type': 'application/json' },
          queryParams: this.buildSampleQueryParams(endpoint),
          body,
          expectedStatus: [400, 422],
          category: 'boundary',
          description: `${fieldName} with ${tooLong.length} chars (above maxLength ${fieldSchema.maxLength}) should return 400`,
        });
      }

      if (fieldSchema.enum && Array.isArray(fieldSchema.enum)) {
        const body = this.buildValidBodyFromSchema(fullSchema);
        body[fieldName] = 'invalid_enum_value_xyz';
        tests.push({
          testName: `${endpoint.method} ${endpoint.path} — ${fieldName} invalid enum value`,
          method: endpoint.method,
          path: this.buildPathWithSampleValues(endpoint),
          headers: { 'Content-Type': 'application/json' },
          queryParams: this.buildSampleQueryParams(endpoint),
          body,
          expectedStatus: [400, 422],
          category: 'boundary',
          description: `${fieldName} with invalid enum value should return 400`,
        });
      }
    }

    return tests;
  }

  // ─── FORMAT TESTS ─────────────────────────────────────────────────────────

  /**
   * Generates format validation tests for fields with a declared `format`.
   *
   * Supported formats and their invalid test values:
   *  - `email`     → 'notanemail', 'missing@'
   *  - `date`      → 'notadate', '2024-13-45'
   *  - `date-time` → 'notadatetime', '2024-13-45T00:00:00Z'
   *  - `uuid`      → 'not-a-uuid', '12345'
   *  - `uri`       → 'not a uri', '://missing-scheme'
   *  - `ipv4`      → '999.999.999.999', '256.0.0.1'
   *
   * @param endpoint    - The parent endpoint
   * @param fieldName   - Name of the field being tested
   * @param fieldSchema - OpenAPI schema for this field
   * @param fullSchema  - Full request body schema for building the base body
   */
  private generateFormatTests(
    endpoint: ParsedEndpoint,
    fieldName: string,
    fieldSchema: any,
    fullSchema: any,
  ): GeneratedTest[] {
    const tests: GeneratedTest[] = [];
    const format = fieldSchema.format;
    if (!format) return tests;

    const invalidValues: Record<string, string[]> = {
      email: ['notanemail', 'missing@', '@nodomain.com', 'no-at-sign'],
      date: ['notadate', '2024-13-45', '2024-00-01', 'yesterday'],
      'date-time': ['notadatetime', '2024-13-45T00:00:00Z'],
      uuid: ['not-a-uuid', '12345', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'],
      uri: ['not a uri', '://missing-scheme'],
      ipv4: ['999.999.999.999', 'not-an-ip', '256.0.0.1'],
    };

    const invalids = invalidValues[format];
    if (!invalids) return tests;

    for (const invalidValue of invalids.slice(0, 2)) {
      const body = this.buildValidBodyFromSchema(fullSchema);
      body[fieldName] = invalidValue;
      tests.push({
        testName: `${endpoint.method} ${endpoint.path} — ${fieldName} invalid ${format}: "${invalidValue}"`,
        method: endpoint.method,
        path: this.buildPathWithSampleValues(endpoint),
        headers: { 'Content-Type': 'application/json' },
        queryParams: this.buildSampleQueryParams(endpoint),
        body,
        expectedStatus: [400, 422],
        category: 'format',
        description: `${fieldName} with invalid ${format} format should return 400`,
      });
    }

    return tests;
  }

  // ─── HAPPY PATH ───────────────────────────────────────────────────────────

  /**
   * Generates the single happy-path test for an endpoint.
   *
   * Uses all sample values, correct types, and all required fields present.
   * Expected status codes are extracted from the spec's 2xx response definitions.
   * Falls back to [200, 201, 204] if none are documented.
   *
   * @param endpoint - The endpoint to generate a happy-path test for
   */
  private generateHappyPathTest(endpoint: ParsedEndpoint): GeneratedTest {
    const expectedStatuses = Object.keys(endpoint.responses)
      .map(Number)
      .filter((s) => s >= 200 && s < 300);

    return {
      testName: `${endpoint.method} ${endpoint.path} — Valid request (happy path)`,
      method: endpoint.method,
      path: this.buildPathWithSampleValues(endpoint),
      headers: { 'Content-Type': 'application/json' },
      queryParams: this.buildSampleQueryParams(endpoint),
      body: this.buildValidBody(endpoint),
      expectedStatus: expectedStatuses.length > 0 ? expectedStatuses : [200, 201, 204],
      category: 'happy-path',
      description: 'Valid request with all correct fields should succeed',
    };
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  /**
   * Recursively flattens `allOf`, `oneOf`, and `anyOf` schema compositions
   * into a single plain object schema with merged `properties` and `required`.
   *
   * This is needed because OpenAPI specs often use composition keywords instead
   * of direct property definitions.
   *
   * @param schema - Raw OpenAPI schema (may contain allOf/oneOf/anyOf)
   * @returns A flat `{ type: 'object', properties, required }` schema
   */
  private resolveSchemaForTests(schema: any): any {
    if (!schema) return { type: 'object', properties: {}, required: [] };

    if (schema.allOf) {
      const merged: any = { type: 'object', properties: {}, required: [] };
      for (const sub of schema.allOf) {
        const r = this.resolveSchemaForTests(sub);
        Object.assign(merged.properties, r.properties || {});
        if (r.required) merged.required = [...merged.required, ...r.required];
      }
      return merged;
    }

    if (schema.oneOf) return this.resolveSchemaForTests(schema.oneOf.find((s: any) => s.type !== 'null') || schema.oneOf[0]);
    if (schema.anyOf) return this.resolveSchemaForTests(schema.anyOf.find((s: any) => s.type !== 'null') || schema.anyOf[0]);

    return schema;
  }

  /**
   * Builds a valid request body from the endpoint's request body schema.
   * Returns `undefined` if the endpoint has no body or uses multipart.
   *
   * @param endpoint - The endpoint to build a body for
   */
  private buildValidBody(endpoint: ParsedEndpoint): any {
    if (!endpoint.requestBody) return undefined;
    if (endpoint.requestBody.isMultipart) return undefined;
    return this.buildValidBodyFromSchema(this.resolveSchemaForTests(endpoint.requestBody.schema));
  }

  /**
   * Constructs a JSON object with sample values for every property in the schema.
   *
   * @param schema - A resolved (flat) object schema
   * @returns Plain object with one sample value per property
   */
  private buildValidBodyFromSchema(schema: any): any {
    if (!schema || schema.type !== 'object') return {};
    const body: any = {};
    const properties = schema.properties || {};

    for (const [key, value] of Object.entries(properties)) {
      body[key] = this.getSampleValue(value as any);
    }
    return body;
  }

  /**
   * Returns a plausible sample value for a given OpenAPI schema.
   *
   * Priority: `example` → `default` → `enum[0]` → type-based default.
   *
   * @param schema - The field schema to generate a value for
   * @returns A value that conforms to the schema type and constraints
   */
  getSampleValue(schema: any): any {
    if (!schema) return 'sample';

    if (schema.example !== undefined) return schema.example;
    if (schema.default !== undefined) return schema.default;
    if (schema.enum && schema.enum.length > 0) return schema.enum[0];

    switch (schema.type) {
      case 'integer':
      case 'number': {
        const min = schema.minimum !== undefined ? schema.minimum : 1;
        const max = schema.maximum !== undefined ? schema.maximum : 100;
        return Math.floor((min + max) / 2) || 1;
      }
      case 'boolean':
        return true;
      case 'array':
        return [this.getSampleValue(schema.items)];
      case 'object':
        return this.buildValidBodyFromSchema(schema);
      case 'string':
      default:
        return this.getSampleStringValue(schema);
    }
  }

  /**
   * Returns a format-aware sample string for string fields.
   *
   * Falls back to a padded `'sample_value'` string that respects
   * `minLength` and `maxLength` constraints.
   *
   * @param schema - A string-type OpenAPI schema
   */
  private getSampleStringValue(schema: any): string {
    switch (schema.format) {
      case 'email':     return 'test@example.com';
      case 'date':      return '2024-01-15';
      case 'date-time': return '2024-01-15T10:00:00Z';
      case 'uuid':      return '550e8400-e29b-41d4-a716-446655440000';
      case 'uri':       return 'https://example.com';
      case 'password':  return 'Password123!';
      case 'ipv4':      return '192.168.1.1';
      default: {
        const min = schema.minLength || 3;
        const max = schema.maxLength || 20;
        const len = Math.min(max, Math.max(min, 10));
        return 'sample_value'.substring(0, len).padEnd(min, 'x');
      }
    }
  }

  /**
   * Returns a value of the wrong type for a given schema field.
   * Used to generate type-validation failure tests.
   *
   * Returns `undefined` when no meaningful wrong-type value can be produced
   * (e.g., for plain string fields where any value could be coerced).
   *
   * @param schema - The field schema to produce a wrong-type value for
   */
  private getWrongTypeValue(schema: any): any {
    switch (schema.type) {
      case 'integer':
      case 'number':  return 'not_a_number';
      case 'boolean': return 'yes_string';
      case 'array':   return 'not_an_array';
      case 'object':  return 'not_an_object';
      case 'string':
        if (schema.format === 'integer') return 12345;
        return undefined;
      default:
        return undefined;
    }
  }

  /**
   * Replaces all `{paramName}` placeholders in the endpoint path with
   * type-appropriate sample values for every path parameter.
   *
   * @param endpoint - The endpoint whose path to populate
   * @returns Concrete path string, e.g. `/pet/1`
   */
  private buildPathWithSampleValues(endpoint: ParsedEndpoint): string {
    let path = endpoint.path;
    for (const param of endpoint.parameters.filter((p) => p.in === 'path')) {
      path = path.replace(`{${param.name}}`, String(this.getSampleValue(param.schema)));
    }
    return path;
  }

  /**
   * Replaces a specific path parameter with the provided value,
   * filling remaining path parameters with sample values.
   *
   * @param endpoint  - The endpoint whose path to populate
   * @param paramName - The parameter to override
   * @param value     - The override value (as a string)
   * @returns Concrete path string with the override applied
   */
  private buildPathWithValue(endpoint: ParsedEndpoint, paramName: string, value: string): string {
    let path = endpoint.path;
    for (const param of endpoint.parameters.filter((p) => p.in === 'path')) {
      path = path.replace(
        `{${param.name}}`,
        param.name === paramName ? value : String(this.getSampleValue(param.schema)),
      );
    }
    return path;
  }

  /**
   * Builds a query params object containing only the required query parameters,
   * each populated with a sample value.
   *
   * @param endpoint - The endpoint to extract required query params from
   * @returns Record of `{ paramName: sampleValue }` for required query params only
   */
  private buildSampleQueryParams(endpoint: ParsedEndpoint): Record<string, any> {
    const params: Record<string, any> = {};
    for (const param of endpoint.parameters.filter((p) => p.in === 'query' && p.required)) {
      params[param.name] = this.getSampleValue(param.schema);
    }
    return params;
  }
}
