import { Injectable, Logger } from '@nestjs/common';
import { ParsedEndpoint } from '../swagger-parser/swagger-parser.dto';

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
  private generateQueryParamTests(endpoint: ParsedEndpoint, queryParams: any[]): GeneratedTest[] {
    const tests: GeneratedTest[] = [];

    for (const param of queryParams) {
      if (!param.required) continue;

      // Missing required query param
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

      // Boundary tests
      tests.push(...this.generateBoundaryTests(endpoint, fieldName, fs, resolvedSchema));

      // Format tests
      tests.push(...this.generateFormatTests(endpoint, fieldName, fs, resolvedSchema));
    }

    return tests;
  }

  // ─── BOUNDARY TESTS ───────────────────────────────────────────────────────
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

  private buildValidBody(endpoint: ParsedEndpoint): any {
    if (!endpoint.requestBody) return undefined;
    if (endpoint.requestBody.isMultipart) return undefined;
    return this.buildValidBodyFromSchema(this.resolveSchemaForTests(endpoint.requestBody.schema));
  }

  private buildValidBodyFromSchema(schema: any): any {
    if (!schema || schema.type !== 'object') return {};
    const body: any = {};
    const properties = schema.properties || {};

    for (const [key, value] of Object.entries(properties)) {
      body[key] = this.getSampleValue(value as any);
    }
    return body;
  }

  getSampleValue(schema: any): any {
    if (!schema) return 'sample';

    if (schema.example !== undefined) return schema.example;
    if (schema.default !== undefined) return schema.default;
    if (schema.enum && schema.enum.length > 0) return schema.enum[0];

    // Handle nullable
    if (schema.nullable) {
      // don't return null for sample - use valid value
    }

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

  private getSampleStringValue(schema: any): string {
    switch (schema.format) {
      case 'email': return 'test@example.com';
      case 'date': return '2024-01-15';
      case 'date-time': return '2024-01-15T10:00:00Z';
      case 'uuid': return '550e8400-e29b-41d4-a716-446655440000';
      case 'uri': return 'https://example.com';
      case 'password': return 'Password123!';
      case 'ipv4': return '192.168.1.1';
      default: {
        const min = schema.minLength || 3;
        const max = schema.maxLength || 20;
        const len = Math.min(max, Math.max(min, 10));
        return 'sample_value'.substring(0, len).padEnd(min, 'x');
      }
    }
  }

  private getWrongTypeValue(schema: any): any {
    switch (schema.type) {
      case 'integer':
      case 'number':
        return 'not_a_number';
      case 'boolean':
        return 'yes_string';
      case 'array':
        return 'not_an_array';
      case 'object':
        return 'not_an_object';
      case 'string':
        if (schema.format === 'integer') return 12345;
        return undefined; // hard to give wrong type for string
      default:
        return undefined;
    }
  }

  private buildPathWithSampleValues(endpoint: ParsedEndpoint): string {
    let path = endpoint.path;
    const pathParams = endpoint.parameters.filter((p) => p.in === 'path');

    for (const param of pathParams) {
      const value = this.getSampleValue(param.schema);
      path = path.replace(`{${param.name}}`, String(value));
    }

    return path;
  }

  private buildPathWithValue(endpoint: ParsedEndpoint, paramName: string, value: string): string {
    let path = endpoint.path;
    const pathParams = endpoint.parameters.filter((p) => p.in === 'path');

    for (const param of pathParams) {
      if (param.name === paramName) {
        path = path.replace(`{${param.name}}`, value);
      } else {
        path = path.replace(`{${param.name}}`, String(this.getSampleValue(param.schema)));
      }
    }

    return path;
  }

  private buildSampleQueryParams(endpoint: ParsedEndpoint): Record<string, any> {
    const params: Record<string, any> = {};
    const queryParams = endpoint.parameters.filter((p) => p.in === 'query' && p.required);

    for (const param of queryParams) {
      params[param.name] = this.getSampleValue(param.schema);
    }

    return params;
  }
}
