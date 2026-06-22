/**
 * Unit tests — RuleEngineService
 * Tests that each category generates the expected test shape.
 */
import { RuleEngineService } from './rule-engine.service';
import { ParsedEndpoint } from '../swagger-parser/swagger-parser.dto';

function makeEndpoint(overrides: Partial<ParsedEndpoint> = {}): ParsedEndpoint {
  return {
    method: 'GET',
    path: '/users/{id}',
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
    ],
    responses: { '200': { description: 'OK' }, '404': { description: 'Not found' } },
    security: ['bearerAuth'],
    ...overrides,
  };
}

describe('RuleEngineService', () => {
  let service: RuleEngineService;

  beforeEach(() => {
    service = new RuleEngineService();
  });

  // ── Auth tests ─────────────────────────────────────────────────────────────

  it('generates auth tests for secured endpoints', () => {
    const endpoint = makeEndpoint();
    const tests = service.generateTests(endpoint, true);

    const authTests = tests.filter((t) => t.category === 'auth');
    expect(authTests.length).toBeGreaterThanOrEqual(2);

    const noAuthTest = authTests.find((t) => t.testName.includes('No auth'));
    expect(noAuthTest).toBeDefined();
    expect(noAuthTest?.expectedStatus).toContain(401);
    expect(noAuthTest?.headers?.Authorization).toBeUndefined();

    const invalidAuthTest = authTests.find((t) => t.testName.includes('Invalid auth'));
    expect(invalidAuthTest).toBeDefined();
    expect(invalidAuthTest?.headers?.Authorization).toContain('invalid_token');
    expect(invalidAuthTest?.expectedStatus).toContain(401);
  });

  it('does NOT generate auth tests for unsecured endpoints', () => {
    const endpoint = makeEndpoint({ security: [] });
    const tests = service.generateTests(endpoint, false);
    const authTests = tests.filter((t) => t.category === 'auth');
    expect(authTests).toHaveLength(0);
  });

  // ── Path param tests ───────────────────────────────────────────────────────

  it('generates path-param tests for integer path params', () => {
    const endpoint = makeEndpoint();
    const tests = service.generateTests(endpoint, false);
    const pathTests = tests.filter((t) => t.category === 'path-param');

    expect(pathTests.length).toBeGreaterThanOrEqual(3);
    expect(pathTests.some((t) => t.path.includes('99999999'))).toBe(true);   // non-existent
    expect(pathTests.some((t) => t.path.includes('not-a-number'))).toBe(true); // string for numeric
    expect(pathTests.some((t) => t.path.includes('-1'))).toBe(true);          // negative
  });

  it('generates UUID path-param tests for uuid format', () => {
    const endpoint = makeEndpoint({
      method: 'GET',
      path: '/items/{uuid}',
      parameters: [{ name: 'uuid', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      security: [],
    });
    const tests = service.generateTests(endpoint, false);
    const pathTests = tests.filter((t) => t.category === 'path-param');
    expect(pathTests.some((t) => t.path.includes('not-a-uuid'))).toBe(true);
  });

  // ── Body tests ─────────────────────────────────────────────────────────────

  it('generates body tests for POST endpoints with required fields', () => {
    const endpoint: ParsedEndpoint = {
      method: 'POST',
      path: '/users',
      parameters: [],
      requestBody: {
        required: true,
        contentType: 'application/json',
        isMultipart: false,
        schema: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
          },
        },
      },
      responses: { '201': { description: 'Created' } },
      security: [],
    };

    const tests = service.generateTests(endpoint, false);
    const bodyTests = tests.filter((t) => t.category === 'body');
    const reqFieldTests = tests.filter((t) => t.category === 'required-field');

    expect(bodyTests.length).toBeGreaterThanOrEqual(1); // empty body
    expect(reqFieldTests.some((t) => t.testName.includes('email'))).toBe(true);
    expect(reqFieldTests.some((t) => t.testName.includes('password'))).toBe(true);
  });

  it('generates boundary tests for fields with min/max length', () => {
    const endpoint: ParsedEndpoint = {
      method: 'POST',
      path: '/items',
      parameters: [],
      requestBody: {
        required: true,
        contentType: 'application/json',
        isMultipart: false,
        schema: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 3, maxLength: 20 },
          },
        },
      },
      responses: { '201': { description: 'Created' } },
      security: [],
    };

    const tests = service.generateTests(endpoint, false);
    const boundaryTests = tests.filter((t) => t.category === 'boundary');
    expect(boundaryTests.some((t) => t.testName.includes('too short'))).toBe(true);
    expect(boundaryTests.some((t) => t.testName.includes('too long'))).toBe(true);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('generates a happy-path test for every endpoint', () => {
    const endpoint = makeEndpoint();
    const tests = service.generateTests(endpoint, false);
    const happyPath = tests.filter((t) => t.category === 'happy-path');
    expect(happyPath).toHaveLength(1);
    expect(happyPath[0].expectedStatus).toContain(200);
  });

  // ── Multipart skip ─────────────────────────────────────────────────────────

  it('skips multipart endpoints', () => {
    const endpoint: ParsedEndpoint = {
      method: 'POST',
      path: '/upload',
      parameters: [],
      requestBody: {
        required: true,
        contentType: 'multipart/form-data',
        isMultipart: true,
        schema: {},
      },
      responses: { '200': { description: 'OK' } },
      security: [],
    };
    const tests = service.generateTests(endpoint, false);
    expect(tests).toHaveLength(1);
    expect(tests[0].isSkipped).toBe(true);
  });

  // ── getSampleValue ─────────────────────────────────────────────────────────

  it('getSampleValue returns correct types', () => {
    expect(typeof service.getSampleValue({ type: 'integer' })).toBe('number');
    expect(typeof service.getSampleValue({ type: 'boolean' })).toBe('boolean');
    expect(Array.isArray(service.getSampleValue({ type: 'array', items: { type: 'string' } }))).toBe(true);
    expect(service.getSampleValue({ type: 'string', format: 'email' })).toMatch(/@/);
    expect(service.getSampleValue({ type: 'string', format: 'uuid' })).toMatch(/^[0-9a-f-]{36}$/i);
    expect(service.getSampleValue({ enum: ['a', 'b', 'c'] })).toBe('a');
    expect(service.getSampleValue({ example: 'my-example' })).toBe('my-example');
  });
});
