/**
 * @file schema-diff.service.ts
 * @description Compares actual API response bodies against their OpenAPI schema
 * definitions to surface structural contract violations.
 *
 * Each comparison produces a {@link SchemaDiff} containing a list of
 * {@link FieldDiff} entries — one per discrepancy — categorised as:
 *  - `missing`       — field required by schema but absent from the response
 *  - `extra`         — field present in response but not declared in schema
 *  - `wrong_type`    — field present in both but with a mismatched JSON type
 *  - `null_unexpected` — non-nullable schema field returned as null
 *
 * The service is intentionally schema-lenient: it warns on structural issues
 * but does not fail on absent optional fields. Deeply nested objects are
 * traversed recursively up to a configurable depth.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ParsedEndpoint } from '../swagger-parser/swagger-parser.dto';
import { TestResult } from '../test-runner/test-runner.service';

// ── Public types ─────────────────────────────────────────────────────────────

/** One structural discrepancy between the response body and the schema. */
export interface FieldDiff {
  /** Dot-notation path to the field, e.g. `"user.address.zip"`. */
  field: string;
  /** Category of the discrepancy. */
  change: 'missing' | 'extra' | 'wrong_type' | 'null_unexpected';
  /** Type declared in the OpenAPI schema (if applicable). */
  expected?: string;
  /** Actual JSON type found in the response body (if applicable). */
  actual?: string;
}

/** Result of comparing one response body to its OpenAPI schema definition. */
export interface SchemaDiff {
  /** True when at least one structural discrepancy was found. */
  hasIssues: boolean;
  /** All discovered discrepancies, ordered by field path. */
  diffs: FieldDiff[];
}

// ── Implementation ────────────────────────────────────────────────────────────

/** JSON types used in OpenAPI schemas and how they map to `typeof` results. */
const JSON_TYPE_MAP: Record<string, string[]> = {
  string:  ['string'],
  number:  ['number'],
  integer: ['number'],
  boolean: ['boolean'],
  object:  ['object'],
  array:   ['object'], // typeof [] === 'object'
};

const MAX_DEPTH = 5;

@Injectable()
export class SchemaDiffService {
  private readonly logger = new Logger(SchemaDiffService.name);

  /**
   * Annotate every test result that has a response body with a {@link SchemaDiff}
   * by matching its endpoint + status code to the OpenAPI spec.
   *
   * Results without a `responseBody`, or whose endpoint/schema cannot be found
   * in the spec, are left unchanged (no `schemaDiff` property added).
   *
   * @param results   - All test results from the run
   * @param endpoints - Parsed OpenAPI endpoints (from {@link SwaggerParserService})
   * @returns The same array, mutated in-place with `schemaDiff` attached
   */
  annotateResults(results: TestResult[], endpoints: ParsedEndpoint[]): TestResult[] {
    for (const result of results) {
      if (!result.responseBody || result.actual === null) continue;

      const endpoint = this.findEndpoint(result.method, result.path, endpoints);
      if (!endpoint) continue;

      const statusKey = String(result.actual);
      const response = endpoint.responses[statusKey]
        ?? endpoint.responses[`${statusKey[0]}XX`]
        ?? endpoint.responses['default'];

      if (!response?.schema) continue;

      try {
        const diffs = this.diffObject(result.responseBody, response.schema, '');
        result.schemaDiff = { hasIssues: diffs.length > 0, diffs };
      } catch (err) {
        this.logger.warn(`Schema diff failed for ${result.method} ${result.path}: ${err.message}`);
      }
    }

    return results;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Find the OpenAPI endpoint definition that matches a result's method + path.
   *
   * Path template matching handles parameterised segments, e.g.:
   * spec path `/pets/{id}` matches result path `/pets/123`.
   */
  private findEndpoint(
    method: string,
    path: string,
    endpoints: ParsedEndpoint[],
  ): ParsedEndpoint | undefined {
    const m = method.toUpperCase();

    // 1. Exact match first (fast path)
    const exact = endpoints.find(
      (e) => e.method.toUpperCase() === m && e.path === path,
    );
    if (exact) return exact;

    // 2. Template match: replace {param} segments with a wildcard and compare
    const sameMethod = endpoints.filter((e) => e.method.toUpperCase() === m);
    for (const ep of sameMethod) {
      const pattern = ep.path.replace(/\{[^}]+\}/g, '[^/]+');
      if (new RegExp(`^${pattern}$`).test(path)) return ep;
    }

    return undefined;
  }

  /**
   * Recursively diff an object against its OpenAPI schema definition.
   *
   * Handles nested objects, arrays (checks first element against `items`
   * schema), and primitive types. Stops at {@link MAX_DEPTH} to guard
   * against deeply circular responses.
   *
   * @param body   - The parsed JSON response body (or a nested sub-object)
   * @param schema - The OpenAPI schema fragment for this level
   * @param prefix - Dot-notation path prefix for field names in this frame
   * @param depth  - Current recursion depth
   */
  private diffObject(
    body: any,
    schema: any,
    prefix: string,
    depth = 0,
  ): FieldDiff[] {
    if (depth > MAX_DEPTH) return [];
    if (!schema || !schema.properties) return [];

    const diffs: FieldDiff[] = [];
    const bodyIsObject = body !== null && typeof body === 'object' && !Array.isArray(body);

    if (!bodyIsObject) return diffs;

    const schemaProps: Record<string, any> = schema.properties ?? {};
    const required: Set<string> = new Set(schema.required ?? []);
    const bodyKeys = new Set(Object.keys(body));

    // ── Check declared schema fields ───────────────────────────────────────
    for (const [field, fieldSchema] of Object.entries(schemaProps)) {
      const fullPath = prefix ? `${prefix}.${field}` : field;
      const inBody = bodyKeys.has(field);

      if (!inBody) {
        // Only flag missing required fields; optional absences are acceptable
        if (required.has(field)) {
          diffs.push({ field: fullPath, change: 'missing', expected: fieldSchema.type ?? 'any' });
        }
        continue;
      }

      const bodyVal = body[field];

      // Null check
      if (bodyVal === null) {
        const nullable = fieldSchema.nullable === true
          || fieldSchema['x-nullable'] === true
          || (fieldSchema.type === 'null');
        if (!nullable) {
          diffs.push({
            field: fullPath,
            change: 'null_unexpected',
            expected: fieldSchema.type ?? 'any',
            actual: 'null',
          });
        }
        continue;
      }

      // Type check
      const expectedType: string | undefined = fieldSchema.type;
      if (expectedType && expectedType !== 'null') {
        const allowedJsTypes = JSON_TYPE_MAP[expectedType];
        const actualJsType = Array.isArray(bodyVal) ? 'array' : typeof bodyVal;

        if (allowedJsTypes && !allowedJsTypes.includes(typeof bodyVal)) {
          // Special-case: integer allows number
          const isIntegerMismatch = expectedType === 'integer' && typeof bodyVal === 'number';
          if (!isIntegerMismatch) {
            diffs.push({
              field: fullPath,
              change: 'wrong_type',
              expected: expectedType,
              actual: actualJsType,
            });
            continue; // Don't recurse into a wrong-typed field
          }
        }

        // Recurse into nested objects
        if (expectedType === 'object' && fieldSchema.properties) {
          diffs.push(...this.diffObject(bodyVal, fieldSchema, fullPath, depth + 1));
        }

        // Recurse into array items (first element only, as a sample)
        if (expectedType === 'array' && Array.isArray(bodyVal) && bodyVal.length > 0 && fieldSchema.items) {
          diffs.push(...this.diffObject(bodyVal[0], fieldSchema.items, `${fullPath}[0]`, depth + 1));
        }
      }
    }

    // ── Flag extra fields not declared in the schema ──────────────────────
    for (const key of bodyKeys) {
      if (!(key in schemaProps)) {
        const fullPath = prefix ? `${prefix}.${key}` : key;
        // Skip common meta fields that are routinely undeclared
        if (!['links', '_links', 'meta', '_meta', 'pagination'].includes(key)) {
          diffs.push({ field: fullPath, change: 'extra' });
        }
      }
    }

    return diffs;
  }
}
