import React, { useState, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { TestReport, TestResult, METHOD_COLORS, CATEGORY_LABELS } from "../types";
import { exportToExcel, exportToCsv } from "../utils/exportExcel";
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  SkipForward, 
  RefreshCw, 
  FileText, 
  Cpu, 
  Sparkles, 
  Clock, 
  Globe, 
  Search,
  Percent,
  Download,
  AlertCircle,
  Braces,
  Info,
  Code,
  FileCode,
  ArrowRight,
  Sparkle,
  Copy,
  Check,
  Terminal,
  Server,
  Layers
} from "lucide-react";

interface ReportProps {
  report: TestReport;
  onReset: () => void;
  aiInsightsLoading?: boolean;
  aiInsights?: string | null;
  onRequestAiInsights?: (report: TestReport) => void;
  rootCauses?: Record<string, { loading: boolean; text: string | null }>;
  onRequestRootCause?: (testKey: string, result: TestResult) => void;
}

// Helper to render bold strings in markdown
function renderBoldText(text: string) {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="font-bold text-white font-sans">{part}</strong> : part);
}

// Lightweight Markdown Renderer
function MarkdownBlock({ text }: { text: string }) {
  if (!text) return null;
  
  const lines = text.split('\n');
  return (
    <div className="space-y-3.5 text-xs leading-relaxed font-sans text-slate-300">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('###')) {
          return (
            <h4 key={idx} className="text-xs font-bold text-white uppercase tracking-wider mt-4 mb-2 border-b border-white/[0.05] pb-1.5 flex items-center gap-2 font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span>
              {trimmed.replace(/^###\s*/, '')}
            </h4>
          );
        }
        if (trimmed.startsWith('##')) {
          return <h3 key={idx} className="text-xs font-extrabold text-blue-400 mt-5 mb-2.5 font-mono">{trimmed.replace(/^##\s*/, '')}</h3>;
        }
        if (trimmed.startsWith('#')) {
          return <h2 key={idx} className="text-sm font-black text-white mt-6 mb-3 font-mono">{trimmed.replace(/^#\s*/, '')}</h2>;
        }
        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          const content = trimmed.replace(/^[-*]\s*/, '');
          return (
            <div key={idx} className="flex gap-2.5 pl-3">
              <span className="text-blue-500 font-bold">•</span>
              <span>{renderBoldText(content)}</span>
            </div>
          );
        }
        if (/^\d+\./.test(trimmed)) {
          const content = trimmed.replace(/^\d+\.\s*/, '');
          return (
            <div key={idx} className="flex gap-2.5 pl-3">
              <span className="text-blue-405 font-mono font-bold">{trimmed.match(/^\d+\./)?.[0]}</span>
              <span>{renderBoldText(content)}</span>
            </div>
          );
        }
        return <p key={idx} className="min-h-[1em]">{renderBoldText(line)}</p>;
      })}
    </div>
  );
}

// Circular progress gauge component for API Health Score
function HealthGauge({ score }: { score: number }) {
  const radius = 34;
  const strokeWidth = 6;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  let grade = "F";
  let gradeColor = "text-rose-500";
  let strokeColor = "stroke-rose-500";
  let glowColor = "shadow-[0_0_20px_rgba(244,63,94,0.2)]";
  
  if (score >= 95) {
    grade = "A";
    gradeColor = "text-emerald-400";
    strokeColor = "stroke-emerald-450";
    glowColor = "shadow-[0_0_25px_rgba(16,185,129,0.25)]";
  } else if (score >= 85) {
    grade = "B";
    gradeColor = "text-cyan-400";
    strokeColor = "stroke-cyan-500";
    glowColor = "shadow-[0_0_20px_rgba(34,211,238,0.2)]";
  } else if (score >= 70) {
    grade = "C";
    gradeColor = "text-amber-500";
    strokeColor = "stroke-amber-500";
    glowColor = "shadow-[0_0_20px_rgba(245,158,11,0.15)]";
  } else if (score >= 50) {
    grade = "D";
    gradeColor = "text-orange-500";
    strokeColor = "stroke-orange-500";
    glowColor = "shadow-[0_0_20px_rgba(249,115,22,0.15)]";
  }

  return (
    <div className="flex items-center gap-5 glass-panel rounded-2xl p-5 shadow-lg relative overflow-hidden glow-card-hover border-white/[0.04] bg-[#05070c]/35">
      <div className="relative h-20 w-20 flex items-center justify-center">
        <svg className="h-full w-full transform -rotate-90">
          <circle
            cx="40"
            cy="40"
            r={radius}
            className="stroke-slate-950"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx="40"
            cy="40"
            r={radius}
            className={`${strokeColor} transition-all duration-700`}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <span className={`absolute text-2xl font-black ${gradeColor} tracking-tighter text-shadow`}>{grade}</span>
      </div>
      <div>
        <div className="text-2xl font-black font-mono text-white leading-none tracking-tight">{score.toFixed(1)}%</div>
        <div className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mt-2">API Health Score</div>
      </div>
    </div>
  );
}

// Copy to clipboard helper
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="text-[9px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-900 border border-white/[0.06] text-slate-400 hover:text-white transition-all font-bold uppercase tracking-wider outline-none select-none"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-450" /> : <Copy className="h-3 w-3" />}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

// Formatted JSON block
function JsonBlock({ data }: { data: any }) {
  const formatted =
    data === null || data === undefined
      ? null
      : typeof data === "string"
        ? (() => {
            try {
              return JSON.stringify(JSON.parse(data), null, 2);
            } catch {
              return data;
            }
          })()
        : JSON.stringify(data, null, 2);

  if (!formatted) {
    return (
      <div className="text-slate-550 italic text-[10px] font-mono p-3 bg-slate-950/40 rounded-xl border border-white/[0.03] select-none">— No JSON body —</div>
    );
  }

  return (
    <div className="relative group rounded-xl overflow-hidden border border-white/[0.05] shadow-inner bg-[#040608]">
      <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <CopyButton text={formatted} />
      </div>
      <pre className="px-3.5 py-3 font-mono text-[10px] text-green-400 overflow-auto max-h-56 whitespace-pre-wrap break-all leading-relaxed">
        {formatted}
      </pre>
    </div>
  );
}

function buildCurl(result: TestResult): string {
  const lines: string[] = [];
  lines.push(`curl -X '${result.method}' \\`);
  lines.push(`  '${result.fullUrl}' \\`);
  lines.push(`  -H 'accept: */*' \\`);

  if (result.category === "auth" && result.testName.includes("No auth")) {
    // no auth
  } else if (
    result.category === "auth" &&
    result.testName.includes("Invalid")
  ) {
    lines.push(`  -H 'Authorization: Bearer invalid_token_abc123xyz' \\`);
  } else {
    lines.push(`  -H 'Authorization: Bearer [your-token]' \\`);
  }

  if (result.requestBody !== null && result.requestBody !== undefined) {
    lines.push(`  -H 'Content-Type: application/json' \\`);
    const bodyStr =
      typeof result.requestBody === "string"
        ? result.requestBody
        : JSON.stringify(result.requestBody, null, 2);
    lines.push(`  -d '${bodyStr}'`);
  } else {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = last.endsWith(" \\") ? last.slice(0, -2) : last;
  }

  return lines.join("\n");
}

export default function Report({
  report,
  onReset,
  aiInsightsLoading = false,
  aiInsights = null,
  onRequestAiInsights,
  rootCauses,
  onRequestRootCause,
}: ReportProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "explorer" | "insights">("summary");
  
  // Test Explorer Filters
  const [explorerSearch, setExplorerSearch] = useState("");
  const [explorerStatus, setExplorerStatus] = useState<"all" | "PASS" | "FAIL" | "ERROR" | "SKIPPED">("all");
  const [explorerCategory, setExplorerCategory] = useState<string>("all");
  const [selectedEndpointFilter, setSelectedEndpointFilter] = useState<string | null>(null);

  // Selected Test inside Explorer
  const [selectedTestIndex, setSelectedTestIndex] = useState<number | null>(null);

  // Latency Metrics
  const latencyMetrics = useMemo(() => {
    const nonSkipped = report.allTests.filter((t) => t.status !== "SKIPPED");
    if (nonSkipped.length === 0) return { avg: 0, p50: 0, p95: 0 };

    const latencies = nonSkipped.map((t) => t.responseTime).sort((a, b) => a - b);
    const sum = latencies.reduce((acc, curr) => acc + curr, 0);
    const avg = sum / latencies.length;
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];

    return { avg, p50, p95 };
  }, [report.allTests]);

  // Swagger Coverage
  const coverageMetrics = useMemo(() => {
    const total = report.byEndpoint.length;
    const tested = report.byEndpoint.filter((ep) => ep.total - ep.skipped > 0).length;
    const rate = total > 0 ? (tested / total) * 100 : 0;
    const untested = report.byEndpoint.filter((ep) => ep.total - ep.skipped === 0);

    return { total, tested, rate, untested };
  }, [report.byEndpoint]);

  // API Health Score
  const healthScore = useMemo(() => {
    const totalNonSkipped = report.passed + report.failed + report.errors;
    if (totalNonSkipped === 0) return 100;
    return (report.passed / totalNonSkipped) * 100;
  }, [report]);

  // Recharts Pie Chart Data
  const pieData = useMemo(() => {
    return [
      { name: "Passed", value: report.passed, color: "#10b981" },
      { name: "Failed", value: report.failed, color: "#f43f5e" },
      { name: "Errors", value: report.errors, color: "#f59e0b" },
      { name: "Skipped", value: report.skipped, color: "#64748b" },
    ].filter((d) => d.value > 0);
  }, [report]);

  // Top Slowest Endpoints
  const slowestEndpoints = useMemo(() => {
    return report.byEndpoint
      .filter((ep) => ep.total - ep.skipped > 0)
      .map((ep) => {
        const tests = report.allTests.filter(
          (t) => t.method === ep.method && t.path === ep.endpoint && t.status !== "SKIPPED"
        );
        const avg = tests.length > 0 ? tests.reduce((sum, t) => sum + t.responseTime, 0) / tests.length : 0;
        return {
          name: `${ep.method} ${ep.endpoint}`.substring(0, 22),
          avg: Math.round(avg),
        };
      })
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);
  }, [report.byEndpoint, report.allTests]);

  // Filtered Tests for explorer
  const filteredTests = useMemo(() => {
    return report.allTests.filter((t) => {
      const matchesSearch =
        t.path.toLowerCase().includes(explorerSearch.toLowerCase()) ||
        t.testName.toLowerCase().includes(explorerSearch.toLowerCase());
      
      const matchesStatus = explorerStatus === "all" || t.status === explorerStatus;
      const matchesCategory = explorerCategory === "all" || t.category === explorerCategory;

      const matchesEndpoint =
        !selectedEndpointFilter || `${t.method} ${t.path}` === selectedEndpointFilter;

      return matchesSearch && matchesStatus && matchesCategory && matchesEndpoint;
    });
  }, [report.allTests, explorerSearch, explorerStatus, explorerCategory, selectedEndpointFilter]);

  // Reset selected index on filter change
  React.useEffect(() => {
    setSelectedTestIndex(filteredTests.length > 0 ? 0 : null);
  }, [filteredTests.length]);

  // Categories list for filter
  const categoriesList = useMemo(() => {
    const cats = new Set<string>();
    report.allTests.forEach((t) => cats.add(t.category));
    return Array.from(cats);
  }, [report.allTests]);

  const triggerAiInsights = () => {
    if (onRequestAiInsights) {
      onRequestAiInsights(report);
    }
  };

  const selectedTest = useMemo(() => {
    if (selectedTestIndex === null || selectedTestIndex >= filteredTests.length) return null;
    return filteredTests[selectedTestIndex];
  }, [selectedTestIndex, filteredTests]);

  const selectedTestKey = selectedTest ? `${selectedTest.method}-${selectedTest.path}-${selectedTest.testName}` : "";
  const rootCause = rootCauses?.[selectedTestKey];
  const selectedTestHasFailed = selectedTest && (selectedTest.status === 'FAIL' || selectedTest.status === 'ERROR');

  const triggerDiagnostic = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRequestRootCause && selectedTest) {
      onRequestRootCause(selectedTestKey, selectedTest);
    }
  };

  const statusConfig = {
    PASS: { color: "text-emerald-450", dot: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]", label: "bg-emerald-950/20 text-emerald-450 border border-emerald-900/30", bg: "hover:bg-slate-900/30" },
    FAIL: { color: "text-rose-500", dot: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]", label: "bg-rose-955/20 text-rose-455 border border-rose-900/30", bg: "hover:bg-slate-900/30" },
    ERROR: { color: "text-amber-500", dot: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]", label: "bg-amber-955/20 text-amber-450 border border-amber-900/30", bg: "hover:bg-slate-900/30" },
    SKIPPED: { color: "text-slate-500", dot: "bg-slate-600", label: "bg-slate-800 text-slate-450 border border-slate-700/50", bg: "hover:bg-slate-900/10" }
  };

  const codeColor = (code: number | null) => {
    if (!code) return "text-slate-500";
    if (code < 300) return "text-emerald-450";
    if (code < 400) return "text-blue-400";
    if (code < 500) return "text-amber-400";
    return "text-rose-455";
  };

  const getMethodBadgeClass = (m: string) => {
    const map: Record<string, string> = {
      GET: "bg-blue-600/10 border-blue-500/20 text-blue-400 font-bold",
      POST: "bg-emerald-600/10 border-emerald-500/20 text-emerald-450 font-bold",
      PUT: "bg-amber-600/10 border-amber-500/20 text-amber-400 font-bold",
      DELETE: "bg-rose-600/10 border-rose-500/20 text-rose-500 font-bold",
      PATCH: "bg-orange-600/10 border-orange-500/20 text-orange-400 font-bold"
    };
    return map[m] || "bg-slate-800 border-slate-700 text-slate-300";
  };

  const durationSec = (report.durationMs / 1000).toFixed(1);

  return (
    <div className="min-h-screen text-slate-100 font-sans antialiased relative">
      
      {/* Top Header Workspace */}
      <header className="border-b border-white/[0.04] bg-[#05070c]/50 backdrop-blur-md sticky top-0 z-40">
        <div className="w-full px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Server className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-xs font-bold text-white tracking-tight leading-none uppercase">
                SwaggerPilot <span className="text-blue-500">Dashboard</span>
              </h1>
              <p className="text-[10px] text-slate-500 mt-1 font-mono">
                {report.title} • <span className="text-blue-450">{report.baseUrl}</span>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => exportToExcel(report)}
              className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider bg-slate-900 border border-white/[0.05] hover:border-white/[0.1] hover:bg-slate-800 px-3.5 py-2 rounded-lg text-slate-350 transition-all active:scale-[0.98] shadow outline-none"
            >
              <Download className="h-3.5 w-3.5" />
              <span>XLSX Report</span>
            </button>
            <button
              onClick={() => exportToCsv(report)}
              className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider bg-slate-900 border border-white/[0.05] hover:border-white/[0.1] hover:bg-slate-800 px-3.5 py-2 rounded-lg text-slate-350 transition-all active:scale-[0.98] shadow outline-none"
            >
              <Download className="h-3.5 w-3.5" />
              <span>CSV Log</span>
            </button>
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 text-[10px] uppercase font-extrabold tracking-wider bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-white transition-all active:scale-[0.98] shadow-lg shadow-blue-900/20 outline-none"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>New Run</span>
            </button>
          </div>
        </div>
      </header>

      <div className="w-full px-6 py-6 space-y-6 relative z-10">
        
        {/* Warning Banner */}
        {report.tokenExpiryWarning && (
          <div className="bg-yellow-955/10 border border-yellow-900/50 rounded-xl p-4 flex gap-3 text-yellow-350 shadow-md">
            <AlertCircle className="h-5 w-5 text-yellow-450 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong>Possible Auth Session Expiration:</strong> Multiple 401 Unauthorized status codes occurred consecutively. 
              The server credentials may have expired mid-run. Please verify token parameters before auditing again.
            </div>
          </div>
        )}

        {/* Executive KPI row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <HealthGauge score={healthScore} />

          <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between shadow-lg border-white/[0.04] bg-[#05070c]/35 glow-card-hover">
            <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest flex items-center gap-1.5 font-mono">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Telemetry Totals
            </span>
            <div className="my-2">
              <div className="text-2xl font-black font-mono text-white leading-none tracking-tight">
                {report.passed} <span className="text-xs font-normal text-slate-500">/ {report.totalTests - report.skipped}</span>
              </div>
              <p className="text-[10px] text-slate-455 mt-1.5">Tests passed (excludes skipped runs)</p>
            </div>
            <div className="text-[9px] text-slate-500 font-mono">
              Failed: {report.failed} • Errors: {report.errors}
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between shadow-lg border-white/[0.04] bg-[#05070c]/35 glow-card-hover">
            <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest flex items-center gap-1.5 font-mono">
              <Clock className="h-3.5 w-3.5 text-blue-400" />
              Performance Latency
            </span>
            <div className="my-2">
              <div className="text-2xl font-black font-mono text-white leading-none tracking-tight">
                {Math.round(latencyMetrics.avg)}<span className="text-xs font-normal text-slate-500"> ms</span>
              </div>
              <p className="text-[10px] text-slate-455 mt-1.5">Average response duration</p>
            </div>
            <div className="text-[9px] text-slate-500 font-mono">
              p50: {latencyMetrics.p50}ms • p95: {latencyMetrics.p95}ms
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between shadow-lg border-white/[0.04] bg-[#05070c]/35 glow-card-hover">
            <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest flex items-center gap-1.5 font-mono">
              <Percent className="h-3.5 w-3.5 text-purple-400" />
              Swagger Spec Coverage
            </span>
            <div className="my-2">
              <div className="text-2xl font-black font-mono text-white leading-none tracking-tight">
                {coverageMetrics.rate.toFixed(1)}%
              </div>
              <p className="text-[10px] text-slate-455 mt-1.5">{coverageMetrics.tested} of {coverageMetrics.total} endpoints</p>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden mt-1.5 border border-white/[0.04]">
              <div 
                className="bg-purple-500 h-full rounded-full" 
                style={{ width: `${coverageMetrics.rate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Tab Selection Navigation */}
        <div className="flex border-b border-white/[0.05]">
          {[
            { id: "summary", label: "Executive Dashboard", icon: Activity },
            { id: "insights", label: "AI Watchdog Audit", icon: Sparkles },
            { id: "explorer", label: `Telemetry Explorer (${report.totalTests})`, icon: FileText }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-5 py-3 text-[10px] font-extrabold uppercase tracking-widest border-b-2 transition-all outline-none select-none ${
                  activeTab === tab.id
                    ? "text-blue-400 border-blue-500 bg-blue-500/5"
                    : "text-slate-500 border-transparent hover:text-slate-350"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ──── TAB 1: SUMMARY DASHBOARD ──── */}
        {activeTab === "summary" && (
          <div className="space-y-6">
            
            {/* Heatmap Section */}
            <div className="glass-panel rounded-2xl p-5 shadow-lg space-y-4 border-white/[0.04] bg-[#05070c]/35 glow-card-hover">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <Activity className="h-4.5 w-4.5 text-blue-400" />
                  <div>
                    <h3 className="text-xs font-bold text-white tracking-tight uppercase">Endpoint Health Heatmap Matrix</h3>
                    <p className="text-[9px] text-slate-550">Visual mapping of success rate per API endpoint. Click cells to filter split-screen explorer logs.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-[8px] uppercase font-bold tracking-wider text-slate-500 font-mono">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-emerald-500 inline-block shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>100% PASS</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-emerald-700/80 inline-block"></span>&gt;=80%</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-amber-500/80 inline-block"></span>&gt;=50%</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-rose-500 inline-block shadow-[0_0_8px_rgba(244,63,94,0.4)]"></span>&lt;50%</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-slate-800 inline-block"></span>SKIPPED</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {report.byEndpoint.map((ep, idx) => {
                  const nonSkipped = ep.total - ep.skipped;
                  const successRate = nonSkipped > 0 ? (ep.passed / nonSkipped) * 100 : -1;
                  
                  let cellBg = "bg-slate-800 hover:bg-slate-750"; // default skipped
                  let hoverBorder = "hover:border-slate-500";
                  if (successRate === 100) {
                    cellBg = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.15)]";
                    hoverBorder = "hover:border-emerald-300";
                  } else if (successRate >= 80) {
                    cellBg = "bg-emerald-700/80";
                    hoverBorder = "hover:border-emerald-500";
                  } else if (successRate >= 50) {
                    cellBg = "bg-amber-500/80";
                    hoverBorder = "hover:border-amber-300";
                  } else if (successRate >= 0) {
                    cellBg = "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.15)]";
                    hoverBorder = "hover:border-rose-300 animate-pulse-short";
                  }

                  const isSelected = selectedEndpointFilter === `${ep.method} ${ep.endpoint}`;

                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedEndpointFilter(null);
                        } else {
                          setSelectedEndpointFilter(`${ep.method} ${ep.endpoint}`);
                          setActiveTab("explorer");
                        }
                      }}
                      className={`h-9 w-9 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all border text-[8px] font-bold outline-none ${
                        isSelected ? 'border-white scale-105 shadow-md shadow-white/10 ring-1 ring-white/30' : 'border-transparent ' + hoverBorder
                      } ${cellBg} text-white`}
                      title={`${ep.method} ${ep.endpoint} - Passed: ${ep.passed}/${ep.total - ep.skipped} (${successRate >= 0 ? successRate.toFixed(0) + '%' : 'Skipped'})`}
                    >
                      <span className="opacity-70 text-[7px] leading-none uppercase font-mono">{ep.method.slice(0, 3)}</span>
                      <span className="leading-none mt-0.5 font-mono font-black">{ep.passed}/{ep.total - ep.skipped}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Overall Breakdown Pie */}
              <div className="glass-panel rounded-2xl p-5 shadow-lg border-white/[0.04] bg-[#05070c]/35 glow-card-hover">
                <h3 className="text-[10px] font-bold text-slate-450 uppercase tracking-widest mb-4 font-mono">Overall Results Distribution</h3>
                <div className="h-56 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        outerRadius={75}
                        innerRadius={45}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#05070c",
                          border: "1px solid rgba(255,255,255,0.06)",
                          borderRadius: "8px",
                          fontSize: "10px",
                          fontFamily: "monospace",
                          color: "#f3f4f6"
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Performance Latency Bar */}
              <div className="glass-panel rounded-2xl p-5 shadow-lg border-white/[0.04] bg-[#05070c]/35 glow-card-hover">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] font-bold text-slate-450 uppercase tracking-widest font-mono">Top Slowest Endpoints</h3>
                  <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-widest bg-slate-900 px-2 py-0.5 rounded">p95 Latency (ms)</span>
                </div>
                {slowestEndpoints.length > 0 ? (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={slowestEndpoints} layout="vertical" margin={{ left: -10, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                        <XAxis type="number" stroke="#475569" tick={{ fontSize: 9, fontFamily: 'monospace' }} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          stroke="#475569"
                          tick={{ fontSize: 9, fontFamily: 'monospace' }}
                          width={110}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#05070c",
                            border: "1px solid rgba(255,255,255,0.06)",
                            borderRadius: "8px",
                            fontSize: "10px",
                            fontFamily: "monospace",
                            color: "#f3f4f6"
                          }}
                        />
                        <Bar dataKey="avg" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-56 flex items-center justify-center text-slate-600 font-mono text-xs select-none">
                    No tested latency metrics to display.
                  </div>
                )}
              </div>
            </div>

            {/* Swagger Spec Coverage Table */}
            <div className="glass-panel rounded-2xl p-5 shadow-lg border-white/[0.04] bg-[#05070c]/35 glow-card-hover">
              <div className="flex items-center gap-2 mb-4 border-b border-white/[0.04] pb-2.5">
                <Percent className="h-4.5 w-4.5 text-purple-400" />
                <div>
                  <h3 className="text-xs font-bold text-white tracking-tight uppercase">Swagger Specification Coverage Analysis</h3>
                  <p className="text-[9px] text-slate-550">List of untreated or fully skipped endpoints declared inside the OpenAPI document.</p>
                </div>
              </div>

              {coverageMetrics.untested.length > 0 ? (
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-white/[0.05] text-slate-500 uppercase text-[9px] tracking-wider font-bold">
                        <th className="py-2.5 px-3">Method</th>
                        <th className="py-2.5 px-3">Untested / Skipped Route</th>
                        <th className="py-2.5 px-3 text-right">Reason Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coverageMetrics.untested.map((ep, idx) => (
                        <tr key={idx} className="border-b border-white/[0.02] hover:bg-white/[0.01]">
                          <td className="py-2 px-3 font-mono">
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded leading-none ${getMethodBadgeClass(ep.method)}`}>
                              {ep.method}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-300">{ep.endpoint}</td>
                          <td className="py-2 px-3 text-right text-slate-500 italic text-[9px]">
                            {ep.skipped > 0 ? "Skipped (unsupported params / complex schema)" : "No test cases generated"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 text-emerald-400 font-mono text-xs font-bold bg-[#05070c]/50 rounded-xl border border-white/[0.03]">
                  ✔ 100% Swagger Coverage! All endpoints declared in specification were successfully run.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ──── TAB 2: AI WATCHDOG AUDIT ──── */}
        {activeTab === "insights" && (
          <div className="glass-panel rounded-2xl p-5 shadow-lg space-y-5 border-white/[0.04] bg-[#05070c]/35 glow-card-hover">
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-400 animate-pulse" />
                <div>
                  <h3 className="text-xs font-bold text-white tracking-tight uppercase">AI Suite Watchdog Report</h3>
                  <p className="text-[9px] text-slate-550">Gemini LLM analyses the complete run report, detects failure trends, and offers bug fixes.</p>
                </div>
              </div>
              {!aiInsights && !aiInsightsLoading && (
                <button
                  onClick={triggerAiInsights}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3.5 py-2 bg-gradient-to-r from-purple-650 to-indigo-650 hover:from-purple-600 hover:to-indigo-600 text-white rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-purple-900/10 outline-none select-none"
                >
                  <Cpu className="h-4 w-4 animate-spin-slow" />
                  <span>Generate AI Audit Report</span>
                </button>
              )}
            </div>

            {aiInsightsLoading && (
              <div className="space-y-4 py-8 max-w-2xl animate-pulse">
                <div className="h-4 bg-slate-900 rounded w-1/4"></div>
                <div className="space-y-2">
                  <div className="h-2.5 bg-slate-900 rounded w-full"></div>
                  <div className="h-2.5 bg-slate-900 rounded w-11/12"></div>
                  <div className="h-2.5 bg-slate-900 rounded w-5/6"></div>
                </div>
                <div className="h-4 bg-slate-900 rounded w-1/3"></div>
                <div className="space-y-2">
                  <div className="h-2.5 bg-slate-900 rounded w-full"></div>
                  <div className="h-2.5 bg-slate-900 rounded w-4/5"></div>
                </div>
              </div>
            )}

            {!aiInsights && !aiInsightsLoading && (
              <div className="text-center py-16 text-slate-500 font-mono text-xs space-y-3">
                <Sparkle className="h-8 w-8 text-slate-700 mx-auto" />
                <p>Run static & logical analyses across all test runs using LLM context.</p>
                <p className="text-[10px] text-slate-600">Click the button above to request report audit via Google Gemini.</p>
              </div>
            )}

            {aiInsights && !aiInsightsLoading && (
              <div className="p-4 bg-[#05070c]/50 rounded-2xl border border-white/[0.03] leading-relaxed max-w-4xl shadow-inner">
                <MarkdownBlock text={aiInsights} />
              </div>
            )}
          </div>
        )}

        {/* ──── TAB 3: SPLIT-SCREEN EXPLORER ──── */}
        {activeTab === "explorer" && (
          <div className="flex flex-col space-y-3 h-[calc(100vh-230px)] min-h-[500px]">
            
            {/* Filtering Control Row */}
            <div className="glass-panel rounded-xl p-3 flex flex-col md:flex-row gap-3 shadow-lg border-white/[0.04] bg-[#05070c]/35">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter explorer logs by path or test name..."
                  value={explorerSearch}
                  onChange={(e) => setExplorerSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-white/[0.06] rounded-xl pl-9 pr-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 font-mono text-xs transition-all"
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                {/* Status Filter */}
                <select
                  value={explorerStatus}
                  onChange={(e) => setExplorerStatus(e.target.value as any)}
                  className="bg-slate-950 border border-white/[0.06] rounded-xl px-3 py-2 text-slate-350 text-xs focus:outline-none focus:border-blue-500/50 font-semibold"
                >
                  <option value="all">All Statuses</option>
                  <option value="PASS">PASS</option>
                  <option value="FAIL">FAIL</option>
                  <option value="ERROR">ERROR</option>
                  <option value="SKIPPED">SKIPPED</option>
                </select>

                {/* Category Filter */}
                <select
                  value={explorerCategory}
                  onChange={(e) => setExplorerCategory(e.target.value)}
                  className="bg-slate-950 border border-white/[0.06] rounded-xl px-3 py-2 text-slate-350 text-xs focus:outline-none focus:border-blue-500/50 font-semibold"
                >
                  <option value="all">All Categories</option>
                  {categoriesList.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c] || c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selected Heatmap Alert */}
            {selectedEndpointFilter && (
              <div className="bg-blue-950/20 border border-blue-900/40 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-blue-350 shadow-md animate-fadeIn">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                  <span>Filtered explorer by endpoint: <strong>{selectedEndpointFilter}</strong></span>
                </div>
                <button
                  onClick={() => setSelectedEndpointFilter(null)}
                  className="text-xs text-blue-400 hover:text-blue-300 font-bold underline cursor-pointer select-none"
                >
                  Clear Filter
                </button>
              </div>
            )}

            {/* Split Screen Workspace */}
            <div className="flex-1 flex gap-4 min-h-0">
              
              {/* Left Pane - List (38% width) */}
              <div className="w-[38%] glass-panel rounded-2xl overflow-hidden flex flex-col min-h-0 border-white/[0.04] bg-[#05070c]/35 shadow-lg">
                <div className="bg-[#05070c]/80 border-b border-white/[0.04] px-4 py-2.5 flex items-center justify-between">
                  <span className="text-[9px] uppercase font-black tracking-widest text-slate-450 font-mono">AUDITED LOGS ({filteredTests.length})</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
                  {filteredTests.length > 0 ? (
                    filteredTests.map((t, idx) => {
                      const isSelected = selectedTestIndex === idx;
                      const cfg = statusConfig[t.status];
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedTestIndex(idx)}
                          className={`w-full p-2.5 rounded-xl transition-all border text-left flex items-center gap-3 outline-none ${
                            isSelected 
                              ? 'bg-blue-600/10 border-blue-500/30 shadow shadow-blue-900/5 ring-1 ring-blue-500/20' 
                              : 'bg-transparent border-transparent hover:bg-slate-900/20'
                          }`}
                        >
                          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                          <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded leading-none flex-shrink-0 font-mono ${getMethodBadgeClass(t.method)}`}>
                            {t.method.slice(0, 3)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-[10px] font-bold text-slate-200 truncate tracking-tight">{t.path}</div>
                            <div className="text-[9px] text-slate-500 truncate mt-0.5 font-medium">{t.testName.replace(`${t.method} ${t.path} — `, "")}</div>
                          </div>
                          <span className="text-[9px] font-mono text-slate-500 flex-shrink-0">{t.responseTime}ms</span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="text-center py-16 font-mono text-[10px] text-slate-600 select-none">
                      No logs found matching criteria.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Pane - Detail Inspector (62% width) */}
              <div className="flex-1 glass-panel rounded-2xl overflow-hidden flex flex-col min-h-0 border-white/[0.04] bg-[#05070c]/35 shadow-lg">
                {!selectedTest ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-650 font-mono">
                    <Braces className="h-8 w-8 text-slate-800 mb-3 animate-pulse" />
                    <p className="text-xs font-bold">No Audit Log Selected</p>
                    <p className="text-[9px] text-slate-600 mt-1 max-w-xs leading-relaxed">Select any test case from the left panel to inspect requests, payloads, headers, and AI fixes.</p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col min-h-0">
                    
                    {/* Selected Header */}
                    <div className="bg-[#05070c]/60 border-b border-white/[0.04] p-4 flex items-center justify-between gap-3 flex-shrink-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded leading-none font-mono ${getMethodBadgeClass(selectedTest.method)}`}>
                            {selectedTest.method}
                          </span>
                          <span className="font-mono text-xs font-bold text-white truncate tracking-tight select-all">{selectedTest.path}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5 truncate leading-none font-semibold">{selectedTest.testName}</p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[8px] uppercase font-bold tracking-widest px-2 py-1 rounded ${statusConfig[selectedTest.status].label}`}>
                          {selectedTest.status}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-950/60 px-2 py-1 rounded border border-white/[0.05] flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-500" />
                          {selectedTest.responseTime}ms
                        </span>
                      </div>
                    </div>

                    {/* Scroller contents */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                      
                      {/* Objective */}
                      <div className="bg-[#05070c]/50 border border-white/[0.04] p-3.5 rounded-xl flex gap-3 shadow-inner">
                        <Info className="h-4.5 w-4.5 text-blue-455 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[8px] uppercase tracking-widest font-extrabold text-slate-500 block font-mono">Validation Objective</span>
                          <p className="text-[11px] text-slate-300 leading-relaxed font-sans mt-0.5">{selectedTest.description}</p>
                        </div>
                      </div>

                      {/* Error Alert */}
                      {selectedTest.errorMessage && (
                        <div className="bg-rose-955/10 border border-rose-900/50 rounded-xl p-3.5 flex gap-3 shadow">
                          <AlertTriangle className="h-4.5 w-4.5 text-rose-500 flex-shrink-0 mt-0.5 animate-bounce-short" />
                          <div className="space-y-1">
                            <span className="text-[8px] uppercase tracking-widest font-extrabold text-rose-400 font-mono">Diagnostic Exception Error</span>
                            <p className="text-xs text-rose-300 font-mono break-all leading-normal">{selectedTest.errorMessage}</p>
                          </div>
                        </div>
                      )}

                      {/* Side-by-side payloads */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        
                        {/* Request telemetry */}
                        <div className="space-y-3 bg-slate-950/20 p-3.5 rounded-xl border border-white/[0.03]">
                          <h4 className="text-[9px] uppercase font-extrabold tracking-widest text-slate-450 flex items-center gap-1.5 border-b border-white/[0.04] pb-2 font-mono">
                            <Globe className="h-3.5 w-3.5 text-blue-400" />
                            Outgoing Request
                          </h4>
                          
                          <div className="space-y-3 text-xs">
                            <div>
                              <span className="text-[8px] text-slate-500 uppercase font-bold tracking-widest block mb-1.5 font-mono">Target URL Path</span>
                              <div className="bg-slate-950 p-2.5 rounded-lg border border-white/[0.04] font-mono text-[9px] break-all text-blue-400 flex items-center justify-between gap-2 shadow-inner">
                                <span className="truncate select-all">{selectedTest.fullUrl}</span>
                                <CopyButton text={selectedTest.fullUrl} />
                              </div>
                            </div>

                            <div>
                              <span className="text-[8px] text-slate-500 uppercase font-bold tracking-widest block mb-1.5 font-mono">JSON Payload Body</span>
                              <JsonBlock data={selectedTest.requestBody} />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[8px] text-slate-500 uppercase font-bold tracking-widest font-mono">Equivalent cURL Command</span>
                                <CopyButton text={buildCurl(selectedTest)} />
                              </div>
                              <pre className="bg-[#040608] px-3.5 py-3 rounded-xl border border-white/[0.04] font-mono text-[9px] text-slate-400 overflow-auto whitespace-pre leading-relaxed max-h-32 scrollbar-thin">
                                {buildCurl(selectedTest)}
                              </pre>
                            </div>
                          </div>
                        </div>

                        {/* Response telemetry */}
                        <div className="space-y-3 bg-slate-950/20 p-3.5 rounded-xl border border-white/[0.03]">
                          <h4 className="text-[9px] uppercase font-extrabold tracking-widest text-slate-450 flex items-center gap-1.5 border-b border-white/[0.04] pb-2 font-mono">
                            <ArrowRight className="h-3.5 w-3.5 text-emerald-400" />
                            Incoming Response
                          </h4>
                          
                          <div className="space-y-3 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <span className="text-[8px] text-slate-500 uppercase font-bold tracking-widest block font-mono">Response Code</span>
                                <div className="bg-slate-950 p-2.5 rounded-lg border border-white/[0.04] font-mono text-sm font-bold flex items-center gap-1.5 shadow-inner">
                                  <span className={codeColor(selectedTest.actual)}>{selectedTest.actual ?? "N/A"}</span>
                                  <span className="text-[9px] text-slate-550 font-normal font-sans">({selectedTest.status})</span>
                                </div>
                              </div>
                              <div>
                                <span className="text-[8px] text-slate-500 uppercase font-bold tracking-widest block font-mono">Expected Code</span>
                                <div className="bg-slate-950 p-2.5 rounded-lg border border-white/[0.04] font-mono text-sm font-bold text-slate-400 shadow-inner">
                                  {selectedTest.expected.join(" OR ")}
                                </div>
                              </div>
                            </div>

                            <div>
                              <span className="text-[8px] text-slate-500 uppercase font-bold tracking-widest block mb-1.5 font-mono">Response Body Payload</span>
                              {selectedTest.responseBody !== null && selectedTest.responseBody !== undefined ? (
                                <JsonBlock data={selectedTest.responseBody} />
                              ) : (
                                <div className="text-slate-500 italic text-[9px] font-mono p-3 bg-slate-950/40 rounded-xl border border-white/[0.03] select-none shadow-inner">
                                  {selectedTest.status === "PASS"
                                    ? "— Response payload omitted for passed checks —"
                                    : "— Empty response body —"}
                                </div>
                              )}
                            </div>

                            <div>
                              <span className="text-[8px] text-slate-500 uppercase font-bold tracking-widest block mb-1.5 font-mono">Telemetry Headers</span>
                              <div className="bg-slate-950 rounded-lg border border-white/[0.04] overflow-hidden text-[9px] font-mono shadow-inner">
                                <table className="w-full">
                                  <tbody>
                                    <tr className="border-b border-[#05070c]">
                                      <td className="px-2.5 py-1.5 text-slate-500 font-bold uppercase tracking-wider w-24">Content-Type</td>
                                      <td className="px-2.5 py-1.5 text-slate-350">application/json; charset=utf-8</td>
                                    </tr>
                                    <tr>
                                      <td className="px-2.5 py-1.5 text-slate-500 font-bold uppercase tracking-wider">Latency</td>
                                      <td className="px-2.5 py-1.5 text-slate-350">{selectedTest.responseTime}ms</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>

                      {/* AI Root Cause Panel */}
                      {selectedTestHasFailed && (
                        <div className="bg-[#05070c]/50 border border-white/[0.05] rounded-2xl p-4 space-y-3.5 shadow-lg glow-card-hover">
                          <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-purple-400 animate-pulse" />
                              <span className="text-[9px] font-bold text-white tracking-widest uppercase font-mono">AI Root Cause Diagnostics</span>
                            </div>
                            {!rootCause && (
                              <button
                                onClick={triggerDiagnostic}
                                className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1.5 bg-purple-650 hover:bg-purple-600 text-white rounded-lg transition-all active:scale-[0.98] shadow-md outline-none"
                              >
                                <Cpu className="h-3.5 w-3.5 animate-spin-slow" />
                                <span>Run AI Diagnostics</span>
                              </button>
                            )}
                          </div>

                          {rootCause && (
                            <div className="space-y-2">
                              {rootCause.loading ? (
                                <div className="space-y-2 py-2 animate-pulse">
                                  <div className="h-3 bg-slate-900 rounded w-1/3"></div>
                                  <div className="h-2 bg-slate-900 rounded w-full"></div>
                                  <div className="h-2 bg-slate-900 rounded w-5/6"></div>
                                </div>
                              ) : rootCause.text ? (
                                <div className="p-4 bg-slate-950 border border-white/[0.04] rounded-xl font-sans leading-relaxed text-slate-300 shadow-inner">
                                  <MarkdownBlock text={rootCause.text} />
                                </div>
                              ) : (
                                <span className="text-[9px] text-rose-400 font-mono">Diagnostics execution failed.</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                    </div>

                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* Dashboard bottom metadata info */}
        <footer className="mt-6 pt-4 border-t border-white/[0.04] text-[9px] text-slate-500 flex justify-between flex-wrap gap-4 font-mono">
          <div className="flex gap-4">
            <span>Started: {new Date(report.startedAt).toLocaleString()}</span>
            <span>Duration: {durationSec}s</span>
            <span>Skipped: {report.skipped}</span>
          </div>
          <div>
            <span>Fuzzed Runs: {report.allTests.filter((t) => t.isAiGenerated).length}</span>
          </div>
        </footer>

      </div>
    </div>
  );
}
