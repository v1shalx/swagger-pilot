/**
 * Unit tests — ChainRunnerService
 * Tests flow detection and variable extraction (no network calls).
 */
import { ChainRunnerService } from './chain-runner.service';
import { ParsedEndpoint } from '../swagger-parser/swagger-parser.dto';

function ep(method: string, path: string): ParsedEndpoint {
  return { method, path, parameters: [], responses: {}, security: [] };
}

describe('ChainRunnerService', () => {
  let service: ChainRunnerService;

  beforeEach(() => {
    service = new ChainRunnerService();
  });

  // ── Flow detection ─────────────────────────────────────────────────────────

  it('detects a create→read→delete flow', () => {
    const endpoints = [
      ep('POST', '/pets'),
      ep('GET', '/pets/{petId}'),
      ep('DELETE', '/pets/{petId}'),
      ep('GET', '/pets'),
    ];
    const flows = service.detectFlows(endpoints);
    expect(flows).toHaveLength(1);
    expect(flows[0].resource).toBe('/pets');
    expect(flows[0].create.method).toBe('POST');
    expect(flows[0].read.method).toBe('GET');
    expect(flows[0].delete.method).toBe('DELETE');
  });

  it('returns no flows when DELETE is missing', () => {
    const endpoints = [ep('POST', '/items'), ep('GET', '/items/{id}')];
    const flows = service.detectFlows(endpoints);
    expect(flows).toHaveLength(0);
  });

  it('returns no flows when GET/{id} is missing', () => {
    const endpoints = [ep('POST', '/items'), ep('DELETE', '/items/{id}')];
    const flows = service.detectFlows(endpoints);
    expect(flows).toHaveLength(0);
  });

  it('detects multiple independent flows', () => {
    const endpoints = [
      ep('POST', '/users'),
      ep('GET', '/users/{id}'),
      ep('DELETE', '/users/{id}'),
      ep('POST', '/posts'),
      ep('GET', '/posts/{postId}'),
      ep('DELETE', '/posts/{postId}'),
    ];
    const flows = service.detectFlows(endpoints);
    expect(flows).toHaveLength(2);
    const resources = flows.map((f) => f.resource).sort();
    expect(resources).toEqual(['/posts', '/users']);
  });

  it('does not match nested paths as top-level flows', () => {
    const endpoints = [
      ep('POST', '/users/{userId}/posts'),
      ep('GET', '/users/{userId}/posts/{postId}'),
      ep('DELETE', '/users/{userId}/posts/{postId}'),
    ];
    // /users/{userId}/posts has a path param — should not match our non-param POST filter
    const flows = service.detectFlows(endpoints);
    expect(flows).toHaveLength(0);
  });

  // ── Variable extraction ────────────────────────────────────────────────────

  it('extracts top-level id field', () => {
    const result = service.extractVariables(
      { id: 42, name: 'Fido' },
      [{ variable: 'id', jsonPath: 'id' }],
    );
    expect(result.id).toBe('42');
  });

  it('extracts nested id via dot-path', () => {
    const result = service.extractVariables(
      { data: { id: 99, status: 'ok' } },
      [
        { variable: 'id', jsonPath: 'id' },       // not present at top level
        { variable: 'id', jsonPath: 'data.id' },  // nested
      ],
    );
    expect(result.id).toBe('99');
  });

  it('returns empty object when body is not an object', () => {
    expect(service.extractVariables(null, [{ variable: 'id', jsonPath: 'id' }])).toEqual({});
    expect(service.extractVariables('string', [{ variable: 'id', jsonPath: 'id' }])).toEqual({});
  });

  it('does not overwrite already-extracted variable', () => {
    const result = service.extractVariables(
      { id: 1, userId: 999 },
      [
        { variable: 'id', jsonPath: 'id' },
        { variable: 'id', jsonPath: 'userId' }, // should be skipped since 'id' already found
      ],
    );
    expect(result.id).toBe('1');
  });

  it('returns empty when jsonPath does not exist', () => {
    const result = service.extractVariables(
      { name: 'test' },
      [{ variable: 'id', jsonPath: 'id' }],
    );
    expect(result.id).toBeUndefined();
  });
});
