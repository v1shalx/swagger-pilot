export interface RunTestsConfig {
  swaggerUrl: string;
  baseUrl?: string;
  authType: 'none' | 'bearer' | 'apikey' | 'basic' | 'autologin';
  authValue?: string;
  apiKeyName?: string;
  apiKeyLocation?: 'header' | 'query';
  loginUrl?: string;
  loginUsername?: string;
  loginPassword?: string;
  delayBetweenTests?: number;
  skipAiGeneration?: boolean;
}

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
  progress?: { completed: number; total: number };
}

export interface TestReport {
  title: string;
  swaggerUrl: string;
  baseUrl: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  totalTests: number;
  passed: number;
  failed: number;
  errors: number;
  skipped: number;
  passRate: number;
  tokenExpiryWarning: boolean;
  byEndpoint: EndpointSummary[];
  byCategory: CategorySummary[];
  failedTests: TestResult[];
  allTests: TestResult[];
}

export interface EndpointSummary {
  endpoint: string;
  method: string;
  total: number;
  passed: number;
  failed: number;
  errors: number;
  skipped: number;
}

export interface CategorySummary {
  category: string;
  total: number;
  passed: number;
  failed: number;
}

export interface DryRunResult {
  title: string;
  baseUrl: string;
  endpointCount: number;
  totalTests: number;
  breakdown: {
    endpoint: string;
    testCount: number;
    skipped: boolean;
    skipReason?: string;
  }[];
}

export const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-blue-500',
  POST: 'bg-green-500',
  PUT: 'bg-yellow-500',
  DELETE: 'bg-red-500',
  PATCH: 'bg-orange-500',
  OPTIONS: 'bg-gray-500',
  HEAD: 'bg-purple-500',
};

export const CATEGORY_LABELS: Record<string, string> = {
  auth: '🔐 Auth',
  'path-param': '🔑 Path Param',
  'query-param': '❓ Query Param',
  body: '📦 Body',
  'required-field': '⚠️ Required Field',
  'type-validation': '🔢 Type',
  boundary: '📏 Boundary',
  format: '📋 Format',
  'happy-path': '✅ Happy Path',
  'ai-edge-case': '🤖 AI Edge Case',
  skipped: '⏭️ Skipped',
};
