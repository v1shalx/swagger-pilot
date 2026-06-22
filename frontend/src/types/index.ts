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
  runProfile?: 'smoke' | 'full';
  /** Feature 1: filter to specific endpoints, e.g. ["GET /users/{id}"] */
  selectedEndpoints?: string[];
  /** Feature 2: enable chain tests (default true) */
  runChainTests?: boolean;
  /** Feature 3: IDOR testing */
  runIdorTests?: boolean;
  secondAuthType?: 'none' | 'bearer' | 'apikey' | 'basic' | 'autologin';
  secondAuthValue?: string;
  secondLoginUrl?: string;
  secondLoginUsername?: string;
  secondLoginPassword?: string;
  /** Feature 4: regression baseline files */
  saveBaseline?: string;
  baselineFile?: string;
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
  responseHeaders?: Record<string, string>;
  isAiGenerated: boolean;
  timestamp?: string;
  progress?: { completed: number; total: number };
}

export interface FailureDiagnostic {
  likelyCause: string;
  ownerHint: 'backend' | 'openapi-spec' | 'auth' | 'infrastructure';
  suggestedFix: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  source: 'rules' | 'gemini';
}

export interface ContractDriftItem {
  method: string;
  path: string;
  severity: 'critical' | 'warning' | 'info';
  type: string;
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

export interface ReleaseReadiness {
  status: 'go' | 'warn' | 'no-go';
  label: string;
  reasons: string[];
}

export interface SpecCoverage {
  endpointsTested: number;
  endpointsInSpec: number;
  endpointCoveragePercent: number;
  statusCodesTested: number;
  statusCodesDocumented: number;
  statusCodeCoveragePercent: number;
  headline: string;
}

export interface RegressionDiffItem {
  key: string;
  type: 'newly_failing' | 'newly_passing' | 'status_changed';
  before: { status: string; actual: number | null };
  after: { status: string; actual: number | null };
}

export interface RegressionDiff {
  baselineFile: string;
  newlyFailing: RegressionDiffItem[];
  newlyPassing: RegressionDiffItem[];
  statusChanged: RegressionDiffItem[];
  unchanged: number;
  summary: string;
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
  contractDrift?: ContractDriftReport;
  releaseReadiness?: ReleaseReadiness;
  specCoverage?: SpecCoverage;
  regressionDiff?: RegressionDiff;
  topFailureInsights?: { testKey: string; diagnostic: FailureDiagnostic }[];
  /** @deprecated */
  estimatedManualHoursSaved?: number;
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
  aiTestCount: number;
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
  flow: '🔗 Chain Flow',
  authorization_leak: '🚨 IDOR / AuthZ',
};
