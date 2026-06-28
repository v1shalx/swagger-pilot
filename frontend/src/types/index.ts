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
  /** Run OWASP API Security Top 10 automated probes (adds ~30-60 extra requests). */
  runSecurityProbes?: boolean;
}

// ── Schema Diff types ────────────────────────────────────────────────────────

/**
 * A single structural discrepancy between a response body and the OpenAPI
 * schema definition for that endpoint + status code.
 */
export interface FieldDiff {
  /** Dot-notation path, e.g. `"user.address.zip"`. */
  field: string;
  /**
   * Category of the discrepancy:
   *  - `missing`           — required field absent from response
   *  - `extra`             — field in response not declared in schema
   *  - `wrong_type`        — type mismatch between schema and actual value
   *  - `null_unexpected`   — non-nullable field returned as null
   */
  change: 'missing' | 'extra' | 'wrong_type' | 'null_unexpected';
  /** OpenAPI schema type (if applicable). */
  expected?: string;
  /** Actual JSON type found in the response (if applicable). */
  actual?: string;
}

/** Structural diff summary attached to a {@link TestResult}. */
export interface SchemaDiff {
  hasIssues: boolean;
  diffs: FieldDiff[];
}

// ── Test result ───────────────────────────────────────────────────────────────

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
  /**
   * Structural diff of the response body vs the OpenAPI schema for this
   * endpoint + status code. Present only when the spec defines a schema
   * for the returned status code.
   */
  schemaDiff?: SchemaDiff;
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

/** Stability verdict for a single test case across repeated runs. */
export type FlakinessScore = 'STABLE' | 'FLAKY' | 'HIGHLY_FLAKY';

/** Per-test flakiness entry — one entry per re-run candidate. */
export interface FlakinessEntry {
  testKey: string;
  testName: string;
  method: string;
  path: string;
  score: FlakinessScore;
  /** Boolean per run: true = PASS, false = FAIL/ERROR. */
  runResults: boolean[];
  passCount: number;
  summary: string;
}

/** Aggregated flakiness report attached to {@link TestReport}. */
export interface FlakinessSummary {
  totalAnalyzed: number;
  stableCount: number;
  flakyCount: number;
  highlyFlakyCount: number;
  entries: FlakinessEntry[];
}


// ── OWASP Security Probe types ───────────────────────────────────────────────

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * One OWASP-mapped finding from the security probe scan.
 * `passed: true` means the probe ran but found no issue.
 */
export interface SecurityFinding {
  id: string;
  probeType: 'injection' | 'mass-assignment' | 'rate-limiting' | 'cors' | 'security-headers' | 'verbose-errors';
  endpoint: string;
  severity: SecuritySeverity;
  title: string;
  detail: string;
  evidence?: string;
  recommendation: string;
  owaspCategory: string;
  passed: boolean;
}

/** Aggregated OWASP scan result attached to {@link TestReport}. */
export interface SecuritySummary {
  totalProbes: number;
  vulnerabilities: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  /** 0-100 composite security score — higher is more secure. */
  score: number;
  findings: SecurityFinding[];
  scannedAt: string;
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
  /** Populated when failures were re-run to detect non-deterministic behaviour. */
  flakiness?: FlakinessSummary;
  /** Populated when OWASP security probes were run (opt-in). */
  securityProbes?: SecuritySummary;
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
