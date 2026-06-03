import { Injectable } from '@nestjs/common';
import { ParsedEndpoint } from '../swagger-parser/swagger-parser.dto';
import { TestResult } from '../test-runner/test-runner.service';

export interface ContractDriftItem {
  method: string;
  path: string;
  severity: 'critical' | 'warning' | 'info';
  type:
    | 'undocumented_status'
    | 'untested_endpoint'
    | 'high_failure_rate'
    | 'validation_not_enforced';
  message: string;
  documentedCodes: number[];
  observedCodes: number[];
  exampleTests: string[];
}

export interface ContractDriftReport {
  items: ContractDriftItem[];
  endpointsInSpec: number;
  endpointsTested: number;
  undocumentedStatusCount: number;
  driftScore: number;
}

@Injectable()
export class ContractDriftService {
  analyze(endpoints: ParsedEndpoint[], results: TestResult[]): ContractDriftReport {
    const items: ContractDriftItem[] = [];
    const testedKeys = new Set<string>();

    for (const ep of endpoints) {
      const key = `${ep.method} ${ep.path}`;
      const documentedCodes = this.parseDocumentedCodes(ep.responses);
      const endpointTests = results.filter(
        (r) => r.method === ep.method && r.path === ep.path && r.status !== 'SKIPPED',
      );

      if (endpointTests.length === 0) {
        items.push({
          method: ep.method,
          path: ep.path,
          severity: 'warning',
          type: 'untested_endpoint',
          message: 'Endpoint is declared in the OpenAPI spec but no tests were executed.',
          documentedCodes,
          observedCodes: [],
          exampleTests: [],
        });
        continue;
      }

      testedKeys.add(key);

      const observedCodes = [
        ...new Set(
          endpointTests
            .map((t) => t.actual)
            .filter((c): c is number => c !== null && c > 0),
        ),
      ].sort((a, b) => a - b);

      const hasDefault = Object.keys(ep.responses).includes('default');
      if (!hasDefault && documentedCodes.length > 0) {
        const undocumented = observedCodes.filter((c) => !documentedCodes.includes(c));
        if (undocumented.length > 0) {
          const examples = endpointTests
            .filter((t) => t.actual !== null && undocumented.includes(t.actual))
            .slice(0, 3)
            .map((t) => t.testName);
          items.push({
            method: ep.method,
            path: ep.path,
            severity: undocumented.some((c) => c >= 500) ? 'critical' : 'warning',
            type: 'undocumented_status',
            message: `API returned status code(s) not documented in OpenAPI: ${undocumented.join(', ')}. Spec documents: ${documentedCodes.join(', ') || 'none'}.`,
            documentedCodes,
            observedCodes,
            exampleTests: examples,
          });
        }
      }

      const failed = endpointTests.filter((t) => t.status === 'FAIL' || t.status === 'ERROR').length;
      const failRate = failed / endpointTests.length;
      if (failRate >= 0.5 && endpointTests.length >= 2) {
        items.push({
          method: ep.method,
          path: ep.path,
          severity: failRate >= 0.8 ? 'critical' : 'warning',
          type: 'high_failure_rate',
          message: `${Math.round(failRate * 100)}% of tests failed on this endpoint (${failed}/${endpointTests.length}).`,
          documentedCodes,
          observedCodes,
          exampleTests: endpointTests
            .filter((t) => t.status === 'FAIL')
            .slice(0, 2)
            .map((t) => t.testName),
        });
      }

      const validationTests = endpointTests.filter(
        (t) =>
          ['required-field', 'type-validation', 'boundary', 'body'].includes(t.category) &&
          t.status === 'FAIL' &&
          t.actual !== null &&
          t.actual < 400,
      );
      if (validationTests.length >= 2) {
        items.push({
          method: ep.method,
          path: ep.path,
          severity: 'critical',
          type: 'validation_not_enforced',
          message:
            'Invalid payloads returned success responses — input validation may not match the OpenAPI contract.',
          documentedCodes,
          observedCodes,
          exampleTests: validationTests.slice(0, 2).map((t) => t.testName),
        });
      }
    }

    const critical = items.filter((i) => i.severity === 'critical').length;
    const warning = items.filter((i) => i.severity === 'warning').length;
    const driftPenalty = critical * 15 + warning * 5;
    const driftScore = Math.max(0, 100 - driftPenalty);

    return {
      items: items.sort((a, b) => {
        const order = { critical: 0, warning: 1, info: 2 };
        return order[a.severity] - order[b.severity];
      }),
      endpointsInSpec: endpoints.length,
      endpointsTested: testedKeys.size,
      undocumentedStatusCount: items.filter((i) => i.type === 'undocumented_status').length,
      driftScore,
    };
  }

  private parseDocumentedCodes(responses: Record<string, { description: string }>): number[] {
    const codes: number[] = [];
    for (const key of Object.keys(responses || {})) {
      if (/^\d{3}$/.test(key)) {
        codes.push(parseInt(key, 10));
      }
    }
    return [...new Set(codes)].sort((a, b) => a - b);
  }
}
