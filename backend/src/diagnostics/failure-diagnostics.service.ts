import { Injectable } from '@nestjs/common';
import { TestResult } from '../test-runner/test-runner.service';
import { GeminiService } from '../test-generator/gemini.service';

export interface FailureDiagnostic {
  likelyCause: string;
  ownerHint: 'backend' | 'openapi-spec' | 'auth' | 'infrastructure';
  suggestedFix: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  source: 'rules' | 'gemini';
}

@Injectable()
export class FailureDiagnosticsService {
  constructor(private readonly gemini: GeminiService) {}

  analyzeWithRules(result: TestResult): FailureDiagnostic {
    const { category, actual, expected, errorMessage, testName } = result;

    if (result.status === 'ERROR' || actual === null) {
      if (errorMessage?.includes('ECONNREFUSED') || errorMessage?.includes('ENOTFOUND')) {
        return {
          likelyCause: errorMessage,
          ownerHint: 'infrastructure',
          suggestedFix: 'Verify the API server is running and the base URL is correct.',
          severity: 'critical',
          source: 'rules',
        };
      }
      if (errorMessage?.includes('timed out')) {
        return {
          likelyCause: 'Request timed out before the server responded.',
          ownerHint: 'infrastructure',
          suggestedFix: 'Check server performance, increase timeout, or investigate hung dependencies.',
          severity: 'high',
          source: 'rules',
        };
      }
      return {
        likelyCause: errorMessage || 'Network or client error during request.',
        ownerHint: 'infrastructure',
        suggestedFix: 'Inspect server logs and network connectivity for this endpoint.',
        severity: 'high',
        source: 'rules',
      };
    }

    if (category === 'auth') {
      if (testName.includes('No auth') && actual !== 401 && actual !== 403) {
        return {
          likelyCause: `Endpoint accepted unauthenticated access (got ${actual}, expected 401/403).`,
          ownerHint: 'auth',
          suggestedFix: 'Enforce authentication middleware on this route or update OpenAPI security requirements.',
          severity: 'critical',
          source: 'rules',
        };
      }
      if (testName.includes('Invalid') && actual !== 401 && actual !== 403) {
        return {
          likelyCause: `Invalid credentials were not rejected (got ${actual}).`,
          ownerHint: 'auth',
          suggestedFix: 'Validate bearer/API key tokens before executing handler logic.',
          severity: 'critical',
          source: 'rules',
        };
      }
      return {
        likelyCause: `Authentication behavior did not match expectation (expected ${expected.join('/')}, got ${actual}).`,
        ownerHint: 'auth',
        suggestedFix: 'Review auth guards, token expiry, and OpenAPI security scheme for this operation.',
        severity: 'high',
        source: 'rules',
      };
    }

    if (actual !== null && actual >= 500) {
      return {
        likelyCause: `Server error ${actual} — unhandled exception or downstream failure.`,
        ownerHint: 'backend',
        suggestedFix: 'Check application logs for stack traces; add error handling and return documented 4xx where appropriate.',
        severity: 'critical',
        source: 'rules',
      };
    }

    if (
      ['required-field', 'type-validation', 'boundary', 'body', 'format'].includes(category) &&
      actual !== null &&
      actual < 400
    ) {
      return {
        likelyCause: `Invalid input was accepted (HTTP ${actual}); validation rules may be missing or incorrect.`,
        ownerHint: 'backend',
        suggestedFix: 'Add or fix request validation (DTO/schema) so invalid payloads return 400 as documented in OpenAPI.',
        severity: 'critical',
        source: 'rules',
      };
    }

    if (actual === 404 && category === 'happy-path') {
      return {
        likelyCause: 'Resource not found for a valid happy-path request.',
        ownerHint: 'backend',
        suggestedFix: 'Verify path parameters, seed data, and that the resource exists in the target environment.',
        severity: 'high',
        source: 'rules',
      };
    }

    if (actual === 404 && category === 'path-param') {
      return {
        likelyCause: `Expected ${expected.join(' or ')} for invalid path param but got 404.`,
        ownerHint: 'openapi-spec',
        suggestedFix: 'Align OpenAPI documented responses with API behavior (404 vs 400).',
        severity: 'medium',
        source: 'rules',
      };
    }

    return {
      likelyCause: `Expected HTTP ${expected.join(' or ')}, received ${actual}.`,
      ownerHint: 'backend',
      suggestedFix: 'Compare handler implementation and OpenAPI response definitions for this operation.',
      severity: 'high',
      source: 'rules',
    };
  }

  async analyze(result: TestResult, useAi: boolean): Promise<FailureDiagnostic> {
    const rules = this.analyzeWithRules(result);
    if (!useAi || !this.gemini.isConfigured()) {
      return rules;
    }

    try {
      const ai = await this.gemini.analyzeFailureStructured(result);
      if (ai) {
        return { ...ai, source: 'gemini' };
      }
    } catch {
      // fall through to rules
    }
    return rules;
  }
}
