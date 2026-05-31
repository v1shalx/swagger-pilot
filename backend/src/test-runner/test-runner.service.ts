import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { GeneratedTest } from '../test-generator/rule-engine.service';
import { AuthHandlerService } from './auth-handler.service';
import { RunTestsDto } from '../swagger-parser/swagger-parser.dto';

export interface TestResult {
  testName: string;
  method: string;
  path: string;
  fullUrl: string;
  status: 'PASS' | 'FAIL' | 'ERROR' | 'SKIPPED';
  expected: number[];
  actual: number | null;
  responseTime: number;
  category: string;
  description: string;
  errorMessage?: string;
  requestBody?: any;
  responseBody?: any;
  isAiGenerated: boolean;
}

@Injectable()
export class TestRunnerService {
  private readonly logger = new Logger(TestRunnerService.name);
  private tokenExpiryDetected = false;
  private requestCount = 0;

  async runTest(
    test: GeneratedTest,
    baseUrl: string,
    dto: RunTestsDto,
    authHeaders: Record<string, string>,
    authQueryParams: Record<string, string>,
    onResult: (result: TestResult) => void,
  ): Promise<TestResult> {
    // Handle skipped tests
    if (test.isSkipped) {
      const result: TestResult = {
        testName: test.testName,
        method: test.method,
        path: test.path,
        fullUrl: `${baseUrl}${test.path}`,
        status: 'SKIPPED',
        expected: [],
        actual: null,
        responseTime: 0,
        category: test.category,
        description: test.skipReason || 'Skipped',
        isAiGenerated: test.testName.startsWith('[AI]'),
      };
      onResult(result);
      return result;
    }

    // Determine which auth headers to use for this test
    const isNoAuthTest = test.category === 'auth' && test.testName.includes('No auth');
    const isInvalidAuthTest = test.category === 'auth' && test.testName.includes('Invalid auth');
    const testHeaders = isNoAuthTest || isInvalidAuthTest
      ? test.headers  // use test-specific headers (no auth or invalid)
      : { ...test.headers, ...authHeaders }; // merge with valid auth

    // Build full URL
    const cleanBase = baseUrl.replace(/\/$/, '');
    const cleanPath = test.path.startsWith('/') ? test.path : `/${test.path}`;
    const fullUrl = `${cleanBase}${cleanPath}`;

    // Merge query params
    const queryParams = {
      ...test.queryParams,
      ...(isNoAuthTest || isInvalidAuthTest ? {} : authQueryParams),
    };

    const startTime = Date.now();
    let result: TestResult;

    try {
      const response = await axios({
        method: test.method.toLowerCase() as any,
        url: fullUrl,
        headers: testHeaders,
        params: queryParams,
        data: test.body,
        timeout: 15000,
        validateStatus: () => true, // don't throw on any status
        maxRedirects: 3,
      });

      const responseTime = Date.now() - startTime;
      const actualStatus = response.status;

      // Check token expiry during run
      if (actualStatus === 401 && !isNoAuthTest && !isInvalidAuthTest && this.requestCount > 2) {
        this.logger.warn(`Possible token expiry detected on test: ${test.testName}`);
        this.tokenExpiryDetected = true;
      }

      const passed = test.expectedStatus.includes(actualStatus);

      result = {
        testName: test.testName,
        method: test.method,
        path: test.path,
        fullUrl,
        status: passed ? 'PASS' : 'FAIL',
        expected: test.expectedStatus,
        actual: actualStatus,
        responseTime,
        category: test.category,
        description: test.description,
        requestBody: test.body,
        responseBody: this.truncateBody(response.data),
        isAiGenerated: test.testName.startsWith('[AI]'),
        errorMessage: passed
          ? undefined
          : `Expected status ${test.expectedStatus.join(' or ')}, got ${actualStatus}${this.tokenExpiryDetected ? ' (possible token expiry - check token validity)' : ''}`,
      };
    } catch (err) {
      const responseTime = Date.now() - startTime;
      const axiosErr = err as AxiosError;

      let errorMessage = err.message;
      if (axiosErr.code === 'ECONNREFUSED') {
        errorMessage = `Connection refused to ${fullUrl}. Is the API server running?`;
      } else if (axiosErr.code === 'ETIMEDOUT' || axiosErr.code === 'ECONNABORTED') {
        errorMessage = `Request timed out after 15 seconds`;
      } else if (axiosErr.code === 'ENOTFOUND') {
        errorMessage = `Host not found: ${fullUrl}. Check the base URL.`;
      }

      result = {
        testName: test.testName,
        method: test.method,
        path: test.path,
        fullUrl,
        status: 'ERROR',
        expected: test.expectedStatus,
        actual: null,
        responseTime,
        category: test.category,
        description: test.description,
        errorMessage,
        requestBody: test.body,
        isAiGenerated: test.testName.startsWith('[AI]'),
      };
    }

    this.requestCount++;
    onResult(result);
    return result;
  }

  private truncateBody(body: any): any {
    if (!body) return body;
    const str = typeof body === 'string' ? body : JSON.stringify(body);
    if (str.length > 500) {
      return str.substring(0, 500) + '... [truncated]';
    }
    return body;
  }

  resetState() {
    this.tokenExpiryDetected = false;
    this.requestCount = 0;
  }

  wasTokenExpiryDetected(): boolean {
    return this.tokenExpiryDetected;
  }
}
