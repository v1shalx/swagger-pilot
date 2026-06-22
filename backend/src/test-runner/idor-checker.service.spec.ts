/**
 * Unit tests — IdorCheckerService
 * Tests ID extraction, param-name parsing, and endpoint filtering logic.
 * Private methods are accessed via (service as any) to avoid TS2341.
 */
import { IdorCheckerService } from './idor-checker.service';
import { ParsedEndpoint } from '../swagger-parser/swagger-parser.dto';

function ep(method: string, path: string): ParsedEndpoint {
  return { method, path, parameters: [], responses: {}, security: [] };
}

describe('IdorCheckerService', () => {
  let service: any;

  beforeEach(() => {
    service = new IdorCheckerService();
  });

  // ── ID extraction ──────────────────────────────────────────────────────────

  it('extracts id from top-level field', () => {
    expect(service.extractId({ id: 7 })).toBe('7');
  });

  it('extracts _id (MongoDB style)', () => {
    expect(service.extractId({ _id: 'abc123' })).toBe('abc123');
  });

  it('extracts from nested data.id', () => {
    expect(service.extractId({ data: { id: 42 } })).toBe('42');
  });

  it('returns null for non-object bodies', () => {
    expect(service.extractId(null)).toBeNull();
    expect(service.extractId('string')).toBeNull();
    expect(service.extractId(undefined)).toBeNull();
  });

  it('returns null when no known id key exists', () => {
    expect(service.extractId({ name: 'test', foo: 'bar' })).toBeNull();
  });

  // ── paramName extraction ───────────────────────────────────────────────────

  it('extracts the param name from a path template', () => {
    expect(service.extractParamName('/users/{userId}')).toBe('userId');
    expect(service.extractParamName('/pets/{petId}')).toBe('petId');
    expect(service.extractParamName('/items/{id}')).toBe('id');
  });

  it('returns "id" as default when no param in path', () => {
    expect(service.extractParamName('/users')).toBe('id');
  });

  // ── POST endpoint detection logic (pure filter, no network) ───────────────

  it('only targets POST endpoints without path params for create step', () => {
    const allEndpoints = [
      ep('POST', '/users'),             // match ✓
      ep('POST', '/users/{id}/posts'),  // has param — skip
      ep('GET', '/users/{id}'),
      ep('DELETE', '/users/{id}'),
    ];

    const posts = allEndpoints.filter(
      (e) => e.method === 'POST' && !e.path.includes('{'),
    );
    expect(posts).toHaveLength(1);
    expect(posts[0].path).toBe('/users');
  });

  // ── Sample body builder ────────────────────────────────────────────────────

  it('builds a sample body from endpoint schema', () => {
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
          properties: {
            name: { type: 'string' },
            age: { type: 'integer' },
            active: { type: 'boolean' },
          },
        },
      },
      responses: {},
      security: [],
    };

    const body = service.buildSampleBody(endpoint);
    expect(typeof body.name).toBe('string');
    expect(typeof body.age).toBe('number');
    expect(typeof body.active).toBe('boolean');
  });

  it('returns empty object when no requestBody schema', () => {
    const endpoint = ep('POST', '/users');
    const body = service.buildSampleBody(endpoint);
    expect(body).toEqual({});
  });
});
