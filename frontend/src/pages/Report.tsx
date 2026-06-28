import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
import { exportToPdf, exportToJson } from "../utils/exportPdf";
import { exportClientPdf } from "../utils/exportClientPdf";
import { exportFailedTestsToPostman } from "../utils/exportPostman";
import {
  saveReportSnapshot,
  compareWithPreviousReport,
  estimateHoursSaved,
  loadRunHistory,
} from "../utils/reportHistory";
import { exportClientPack } from "../utils/exportClientPack";
import { exportTestCode } from "../utils/exportTestCode";
import { FailureDiagnostic } from "../types";
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
  Layers,
  Briefcase,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Package,
  FileArchive,
  Shield,
  GitCompare,
  ChevronDown,
} from "lucide-react";

interface ReportProps {
  report: TestReport;
  onReset: () => void;
  aiInsightsLoading?: boolean;
  aiInsights?: string | null;
  onRequestAiInsights?: (report: TestReport) => void;
  rootCauses?: Record<string, { loading: boolean; text: string | null; diagnostic?: FailureDiagnostic }>;
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
  
  if (score >= 95) {
    grade = "A";
    gradeColor = "text-emerald-400";
    strokeColor = "stroke-emerald-450";
  } else if (score >= 85) {
    grade = "B";
    gradeColor = "text-cyan-400";
    strokeColor = "stroke-cyan-500";
  } else if (score >= 70) {
    grade = "C";
    gradeColor = "text-amber-500";
    strokeColor = "stroke-amber-500";
  } else if (score >= 50) {
    grade = "D";
    gradeColor = "text-orange-500";
    strokeColor = "stroke-orange-500";
  }

  return (
    <div className="flex items-center gap-5 glass-panel rounded-2xl p-5 shadow-lg relative overflow-hidden glow-card-hover border-white/[0.04] bg-[#05070c]/35">
      <div className="relative h-20 w-20 flex items-center justify-center">
        <svg className="h-full w-full transform -rotate-90">
          <circle cx="40" cy="40" r={radius} className="stroke-slate-950" strokeWidth={strokeWidth} fill="transparent" />
          <circle cx="40" cy="40" r={radius} className={`${strokeColor} transition-all duration-700`} strokeWidth={strokeWidth} fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
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
  } else if (result.category === "auth" && result.testName.includes("Invalid")) {
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

function ResponseHeadersTable({ headers, responseTime }: { headers?: Record<string, string>; responseTime: number }) {
  const entries =
    headers && Object.keys(headers).length > 0
      ? Object.entries(headers)
      : [["latency", `${responseTime}ms`]];

  return (
    <div className="bg-slate-950 rounded-lg border border-white/[0.04] overflow-hidden text-[9px] font-mono shadow-inner">
      <table className="w-full">
        <tbody>
          {entries.map(([key, value], idx) => (
            <tr key={key} className={idx < entries.length - 1 ? "border-b border-[#05070c]" : ""}>
              <td className="px-2.5 py-1.5 text-slate-500 font-bold uppercase tracking-wider w-32 break-all">{key}</td>
              <td className="px-2.5 py-1.5 text-slate-350 break-all">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Export Dropdown Component ───────────────────────────────────────────────
interface ExportDropdownProps {
  onExportClientPack: () => void;
  onExportClientPdf: () => void;
  onExportPostman: () => void;
  onExportExcel: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  onExportJson: () => void;
}

function ExportDropdown({
  onExportClientPack,
  onExportClientPdf,
  onExportPostman,
  onExportExcel,
  onExportCsv,
  onExportPdf,
  onExportJson,
}: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleItem = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider bg-slate-900 border border-white/[0.07] hover:bg-slate-800 hover:border-white/[0.12] px-3.5 py-2 rounded-lg text-slate-300 hover:text-white transition-all active:scale-[0.97] outline-none select-none"
      >
        <Download className="h-3.5 w-3.5" />
        <span>Export</span>
        <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-56 bg-[#0c0e14] border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl shadow-black/60 animate-fadeIn">
          
          {/* Client Deliverables group */}
          <div className="pt-2 pb-1 px-1">
            <p className="text-[8px] uppercase font-black text-slate-600 tracking-widest px-2.5 py-1 font-mono">
              Client deliverables
            </p>
            <button
              onClick={() => handleItem(onExportClientPack)}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 text-[10px] font-semibold text-violet-400 hover:bg-violet-500/10 hover:text-violet-300 rounded-lg transition-all text-left outline-none"
            >
              <FileArchive className="h-3.5 w-3.5 flex-shrink-0" />
              Client pack (ZIP)
            </button>
            <button
              onClick={() => handleItem(onExportClientPdf)}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 text-[10px] font-semibold text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 rounded-lg transition-all text-left outline-none"
            >
              <Briefcase className="h-3.5 w-3.5 flex-shrink-0" />
              Client PDF
            </button>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/[0.06] mx-2" />

          {/* Dev Tools group */}
          <div className="pt-1 pb-2 px-1">
            <p className="text-[8px] uppercase font-black text-slate-600 tracking-widest px-2.5 py-1 font-mono">
              Dev tools
            </p>
            <button
              onClick={() => handleItem(onExportPostman)}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 text-[10px] font-semibold text-orange-400 hover:bg-orange-500/10 hover:text-orange-300 rounded-lg transition-all text-left outline-none"
            >
              <Package className="h-3.5 w-3.5 flex-shrink-0" />
              Postman collection
            </button>
            <button
              onClick={() => handleItem(onExportExcel)}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 text-[10px] font-semibold text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 rounded-lg transition-all text-left outline-none"
            >
              <Download className="h-3.5 w-3.5 flex-shrink-0" />
              XLSX report
            </button>
            <button
              onClick={() => handleItem(onExportCsv)}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 text-[10px] font-semibold text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 rounded-lg transition-all text-left outline-none"
            >
              <Download className="h-3.5 w-3.5 flex-shrink-0" />
              CSV log
            </button>
            <button
              onClick={() => handleItem(onExportPdf)}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 text-[10px] font-semibold text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 rounded-lg transition-all text-left outline-none"
            >
              <Download className="h-3.5 w-3.5 flex-shrink-0" />
              PDF report
            </button>
            <button
              onClick={() => handleItem(onExportJson)}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 text-[10px] font-semibold text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 rounded-lg transition-all text-left outline-none"
            >
              <Download className="h-3.5 w-3.5 flex-shrink-0" />
              JSON report
            </button>
          </div>
        </div>
      )}
    </div>
  );
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
  const [activeTab, setActiveTab] = useState<"summary" | "explorer" | "insights" | "regression" | "flakiness" | "security">("summary");
  
  // Test Explorer Filters
  const [explorerSearch, setExplorerSearch] = useState("");
  const [explorerStatus, setExplorerStatus] = useState<"all" | "PASS" | "FAIL" | "ERROR" | "SKIPPED">("all");
  const [explorerCategory, setExplorerCategory] = useState<string>("all");
  const [selectedEndpointFilter, setSelectedEndpointFilter] = useState<string | null>(null);

  // Selected Test inside Explorer
  const [selectedTestIndex, setSelectedTestIndex] = useState<number | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExportExcel = useCallback(async () => {
    try {
      setExportError(null);
      await exportToExcel(report);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Excel export failed';
      setExportError(message);
      alert(`Failed to export Excel report: ${message}`);
    }
  }, [report]);

  const handleExportCsv = useCallback(() => {
    try {
      setExportError(null);
      exportToCsv(report);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'CSV export failed';
      setExportError(message);
      alert(`Failed to export CSV report: ${message}`);
    }
  }, [report]);

  const handleExportPdf = useCallback(async () => {
    try {
      setExportError(null);
      await exportToPdf(report, 'report-pdf-export');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'PDF export failed';
      setExportError(message);
      alert(`Failed to export PDF report: ${message}`);
    }
  }, [report]);

  const handleExportJson = useCallback(() => {
    try {
      setExportError(null);
      exportToJson(report);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'JSON export failed';
      setExportError(message);
      alert(`Failed to export JSON report: ${message}`);
    }
  }, [report]);

  const handleExportClientPdf = useCallback(() => {
    try {
      setExportError(null);
      exportClientPdf(report);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Client PDF export failed';
      setExportError(message);
      alert(`Failed to export client PDF: ${message}`);
    }
  }, [report]);

  const handleExportClientPack = useCallback(async () => {
    try {
      setExportError(null);
      await exportClientPack(report);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Client pack export failed';
      setExportError(message);
      alert(`Failed to export client pack: ${message}`);
    }
  }, [report]);

  const handleExportPostman = useCallback(() => {
    try {
      setExportError(null);
      exportFailedTestsToPostman(report);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Postman export failed';
      setExportError(message);
      alert(`Failed to export Postman collection: ${message}`);
    }
  }, [report]);

  const regression = useMemo(() => compareWithPreviousReport(report), [report]);
  const runHistory = useMemo(
    () => loadRunHistory(`${report.swaggerUrl}::${report.baseUrl}`).slice(0, 5),
    [report.swaggerUrl, report.baseUrl],
  );

  useEffect(() => {
    saveReportSnapshot(report);
  }, [report]);

  const hoursSaved = estimateHoursSaved(report.totalTests);

  const getInsight = (testKey: string): FailureDiagnostic | undefined =>
    report.topFailureInsights?.find((i) => i.testKey === testKey)?.diagnostic;

  const readinessStyle =
    report.releaseReadiness?.status === 'go'
      ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
      : report.releaseReadiness?.status === 'warn'
        ? 'bg-amber-600/20 border-amber-500/40 text-amber-300'
        : 'bg-rose-600/20 border-rose-500/40 text-rose-300';
  const heroFailure = report.failedTests[0] ?? null;

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

  const categoryChartData = useMemo(() => {
    const shortLabels: Record<string, string> = {
      auth: 'Auth',
      'path-param': 'Path Param',
      'query-param': 'Query Param',
      body: 'Body',
      'required-field': 'Required',
      'type-validation': 'Type',
      boundary: 'Boundary',
      format: 'Format',
      'happy-path': 'Happy Path',
      'ai-edge-case': 'AI Edge',
      skipped: 'Skipped',
    };
    return report.byCategory.map((c) => ({
      name: shortLabels[c.category] || (CATEGORY_LABELS[c.category] || c.category).replace(/^[^\s]+\s/, ''),
      category: c.category,
      passed: c.passed,
      failed: c.failed,
      total: c.total,
    }));
  }, [report.byCategory]);

  const chartAxisTick = { fontSize: 11, fill: '#cbd5e1', fontFamily: 'monospace' as const };
  const chartAxisStroke = '#64748b';

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
  const ruleInsight = selectedTestKey ? getInsight(selectedTestKey) : undefined;
  const aiDiagnostic = rootCause?.diagnostic;
  const activeDiagnostic = aiDiagnostic ?? ruleInsight;
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
      
      {/* ─── Top Header ─────────────────────────────────────────────────────── */}
      <header className="border-b border-white/[0.04] bg-[#05070c]/50 backdrop-blur-md sticky top-0 z-40">
        <div className="w-full px-6 h-14 flex items-center justify-between gap-4">
          
          {/* Brand */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="h-8 w-8 rounded bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Server className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-xs font-bold text-white tracking-tight leading-none uppercase">
                SwaggerPilot <span className="text-blue-500">Dashboard</span>
              </h1>
              <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                {report.title} · <span className="text-blue-450">{report.baseUrl}</span>
              </p>
            </div>
          </div>

          {/* Actions — Export dropdown + New Run only */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <ExportDropdown
              onExportClientPack={handleExportClientPack}
              onExportClientPdf={handleExportClientPdf}
              onExportPostman={handleExportPostman}
              onExportExcel={handleExportExcel}
              onExportCsv={handleExportCsv}
              onExportPdf={handleExportPdf}
              onExportJson={handleExportJson}
            />
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 text-[10px] uppercase font-extrabold tracking-wider bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-white transition-all active:scale-[0.97] shadow-lg shadow-blue-900/20 outline-none select-none"
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

        {exportError && (
          <div className="bg-rose-950/20 border border-rose-900/40 rounded-xl px-4 py-2 text-rose-300 text-xs font-mono">
            Export error: {exportError}
          </div>
        )}

        {/* Executive summary */}
        <div className="glass-panel rounded-2xl p-6 shadow-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/30 to-[#05070c]/60">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-indigo-400" />
                <h2 className="text-sm font-black text-white uppercase tracking-tight">Executive Summary</h2>
                {report.releaseReadiness && (
                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${readinessStyle}`}>
                    {report.releaseReadiness.label}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
                Automated audit of <strong className="text-white">{report.title}</strong> completed in{" "}
                <strong className="text-white">{durationSec}s</strong> with{" "}
                <strong className="text-white">{report.totalTests}</strong> tests.
                {report.specCoverage && (
                  <> <strong className="text-blue-400">{report.specCoverage.headline}</strong>.</>
                )}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950/60 rounded-xl p-3 border border-white/[0.05]">
                  <div className="text-2xl font-black font-mono text-white">{healthScore.toFixed(0)}%</div>
                  <div className="text-[9px] uppercase font-bold text-slate-400 mt-1">Health score</div>
                </div>
                <div className="bg-slate-950/60 rounded-xl p-3 border border-emerald-500/20">
                  <div className="text-2xl font-black font-mono text-emerald-400">{report.passed}</div>
                  <div className="text-[9px] uppercase font-bold text-slate-400 mt-1">Passed</div>
                </div>
                <div className="bg-slate-950/60 rounded-xl p-3 border border-rose-500/20">
                  <div className="text-2xl font-black font-mono text-rose-400">{report.failed + report.errors}</div>
                  <div className="text-[9px] uppercase font-bold text-slate-400 mt-1">Issues</div>
                </div>
                <div className="bg-slate-950/60 rounded-xl p-3 border border-white/[0.05]">
                  <div className="text-2xl font-black font-mono text-slate-300">{coverageMetrics.rate.toFixed(0)}%</div>
                  <div className="text-[9px] uppercase font-bold text-slate-400 mt-1">Spec coverage</div>
                </div>
              </div>
              {report.releaseReadiness?.reasons && report.releaseReadiness.reasons.length > 0 && (
                <ul className="text-[10px] text-slate-400 space-y-1 list-disc list-inside max-w-2xl">
                  {report.releaseReadiness.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
              {regression.hasPrevious && (
                <div className="flex flex-wrap gap-3 text-[10px] font-mono">
                  <span className={`flex items-center gap-1 px-2 py-1 rounded border ${regression.passRateDelta >= 0 ? 'bg-emerald-950/30 border-emerald-800 text-emerald-300' : 'bg-rose-950/30 border-rose-800 text-rose-300'}`}>
                    {regression.passRateDelta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    Pass rate {regression.passRateDelta >= 0 ? '+' : ''}{regression.passRateDelta}% vs last run
                  </span>
                  {regression.newFailures > 0 && (
                    <span className="px-2 py-1 rounded bg-rose-950/30 border border-rose-800 text-rose-300">
                      {regression.newFailures} new failures
                    </span>
                  )}
                  {regression.fixedFailures > 0 && (
                    <span className="px-2 py-1 rounded bg-emerald-950/30 border border-emerald-800 text-emerald-300">
                      {regression.fixedFailures} fixed since last run
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="lg:w-80 flex-shrink-0 space-y-3">
              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-widest">Top priority failure</span>
              {heroFailure ? (
                <div className="bg-rose-950/20 border border-rose-900/40 rounded-xl p-4 text-xs space-y-2">
                  <div className="font-mono font-bold text-rose-300">
                    {heroFailure.method} {heroFailure.path}
                  </div>
                  <p className="text-slate-400 leading-relaxed">{heroFailure.testName.replace(`${heroFailure.method} ${heroFailure.path} — `, '')}</p>
                  <p className="text-[10px] font-mono text-rose-400/90">
                    Expected {heroFailure.expected.join(' or ')}, got {heroFailure.actual ?? 'N/A'}
                  </p>
                  {(() => {
                    const d = getInsight(`${heroFailure.method}-${heroFailure.path}-${heroFailure.testName}`);
                    return d ? (
                      <div className="pt-2 border-t border-rose-900/30 space-y-1">
                        <p className="text-slate-300"><strong>Cause:</strong> {d.likelyCause}</p>
                        <p className="text-slate-400"><strong>Fix:</strong> {d.suggestedFix}</p>
                        <p className="text-[9px] text-slate-500">Owner: {d.ownerHint} • {d.severity} • {d.source} engine</p>
                      </div>
                    ) : null;
                  })()}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('explorer');
                      setExplorerStatus('all');
                      setExplorerSearch(heroFailure.path);
                    }}
                    className="text-[9px] font-bold uppercase text-blue-400 hover:text-blue-300 underline"
                  >
                    Inspect in explorer →
                  </button>
                </div>
              ) : (
                <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-4 text-xs text-emerald-300 font-bold">
                  No failures — API passed all executed checks.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* KPI Row */}
        <div id="report-pdf-export" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <HealthGauge score={healthScore} />
            <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between shadow-lg border-white/[0.04] bg-[#05070c]/35 glow-card-hover">
              <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest flex items-center gap-1.5 font-mono">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Telemetry Totals
              </span>
              <div className="my-2">
                <div className="text-2xl font-black font-mono text-white leading-none tracking-tight">
                  {report.passed} <span className="text-xs font-normal text-slate-500">/ {report.totalTests}</span>
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
                <div className="bg-purple-500 h-full rounded-full" style={{ width: `${coverageMetrics.rate}%` }} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-panel rounded-2xl p-5 shadow-lg border-white/[0.04] bg-[#05070c]/35">
              <h3 className="text-[10px] font-bold text-slate-450 uppercase tracking-widest mb-4 font-mono">Results Distribution</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={65} innerRadius={40} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {pieData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            {report.failedTests.length > 0 && (
              <div className="glass-panel rounded-2xl p-5 shadow-lg border-white/[0.04] bg-[#05070c]/35">
                <h3 className="text-[10px] font-bold text-slate-450 uppercase tracking-widest mb-3 font-mono">Failed Tests Summary</h3>
                <ul className="space-y-1.5 text-xs font-mono text-slate-300 max-h-48 overflow-y-auto">
                  {report.failedTests.slice(0, 10).map((t, i) => (
                    <li key={i} className="truncate">
                      <span className="text-rose-400 font-bold">{t.method}</span> {t.path} — {t.testName.replace(`${t.method} ${t.path} — `, '')}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/[0.05] flex-wrap">
          {[
            { id: "summary", label: "Executive Dashboard", icon: Activity },
            { id: "insights", label: "AI Watchdog Audit", icon: Sparkles },
            { id: "explorer", label: `Telemetry Explorer (${report.totalTests})`, icon: FileText },
            ...(report.regressionDiff ? [{ id: "regression", label: `Regression Diff`, icon: GitCompare }] : []),
            ...(report.flakiness ? [{ id: "flakiness", label: `Flakiness (${report.flakiness.flakyCount + report.flakiness.highlyFlakyCount} flaky)`, icon: TrendingDown }] : []),
            ...(report.securityProbes ? [{ id: "security", label: `Security (${report.securityProbes.vulnerabilities} issues)`, icon: ShieldCheck }] : []),
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
            {report.contractDrift && (
              <div className="glass-panel rounded-2xl p-5 shadow-lg border-white/[0.04] bg-[#05070c]/35 glow-card-hover">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <GitCompare className="h-4.5 w-4.5 text-purple-400" />
                    <div>
                      <h3 className="text-xs font-bold text-white tracking-tight uppercase">OpenAPI Contract Drift</h3>
                      <p className="text-[9px] text-slate-400">Compares documented spec responses vs what your API actually returned.</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black font-mono text-white">{report.contractDrift.driftScore}</div>
                    <div className="text-[9px] uppercase font-bold text-slate-500">Drift score / 100</div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mb-3 font-mono">
                  {report.contractDrift.endpointsTested} of {report.contractDrift.endpointsInSpec} spec endpoints tested
                  {report.contractDrift.undocumentedStatusCount > 0 &&
                    ` • ${report.contractDrift.undocumentedStatusCount} undocumented status code(s) observed`}
                </p>
                {report.contractDrift.items.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
                    {report.contractDrift.items.map((item, idx) => (
                      <div key={idx} className={`rounded-xl px-3 py-2.5 border text-xs ${item.severity === 'critical' ? 'bg-rose-950/20 border-rose-900/40' : item.severity === 'warning' ? 'bg-amber-950/15 border-amber-900/30' : 'bg-slate-950/40 border-white/[0.04]'}`}>
                        <div className="flex items-center gap-2 font-mono font-bold text-slate-200">
                          <span className="uppercase text-[9px] text-slate-500">{item.severity}</span>
                          {item.method} {item.path}
                        </div>
                        <p className="text-slate-400 mt-1 leading-relaxed">{item.message}</p>
                        {item.documentedCodes.length > 0 && (
                          <p className="text-[9px] text-slate-500 mt-1 font-mono">
                            Spec: {item.documentedCodes.join(', ')} → Observed: {item.observedCodes.join(', ') || '—'}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-emerald-400 font-medium">No contract drift detected — API behavior aligns with OpenAPI documentation.</p>
                )}
              </div>
            )}

            {(report.topFailureInsights?.length ?? 0) > 0 && (
              <div className="glass-panel rounded-2xl p-5 shadow-lg border-white/[0.04] bg-[#05070c]/35">
                <h3 className="text-xs font-bold text-white uppercase tracking-tight flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-rose-400" />
                  Top failure insights
                </h3>
                <div className="space-y-2">
                  {report.topFailureInsights!.map((item) => (
                    <div key={item.testKey} className="rounded-xl px-3 py-2.5 border border-white/[0.05] bg-slate-950/50 text-xs">
                      <div className="flex flex-wrap items-center gap-2 font-mono font-bold text-slate-200">
                        <span className={`text-[8px] uppercase px-1.5 py-0.5 rounded border ${item.diagnostic.severity === 'critical' || item.diagnostic.severity === 'high' ? 'border-rose-800 text-rose-400' : item.diagnostic.severity === 'medium' ? 'border-amber-800 text-amber-400' : 'border-slate-700 text-slate-400'}`}>
                          {item.diagnostic.severity}
                        </span>
                        <span className="text-[9px] text-slate-500">{item.diagnostic.ownerHint}</span>
                        <span className="text-[9px] text-slate-600">• {item.diagnostic.source}</span>
                      </div>
                      <p className="text-slate-400 mt-1">{item.diagnostic.likelyCause}</p>
                      <p className="text-slate-500 mt-0.5 text-[10px]">Fix: {item.diagnostic.suggestedFix}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {runHistory.length > 1 && (
              <div className="glass-panel rounded-2xl p-5 shadow-lg border-white/[0.04] bg-[#05070c]/35">
                <h3 className="text-xs font-bold text-white uppercase tracking-tight flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-blue-400" />
                  Run history (this project)
                </h3>
                <div className="flex flex-wrap gap-2">
                  {runHistory.map((h, i) => (
                    <div key={i} className="px-3 py-2 rounded-lg bg-slate-950 border border-white/[0.05] text-[10px] font-mono">
                      <span className="text-slate-500">{new Date(h.savedAt).toLocaleString()}</span>
                      <span className="text-white font-bold ml-2">{h.report.passRate}%</span>
                      <span className="text-slate-500 ml-1">pass</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Heatmap */}
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
                  let cellBg = "bg-slate-800 hover:bg-slate-750";
                  let hoverBorder = "hover:border-slate-500";
                  if (successRate === 100) { cellBg = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.15)]"; hoverBorder = "hover:border-emerald-300"; }
                  else if (successRate >= 80) { cellBg = "bg-emerald-700/80"; hoverBorder = "hover:border-emerald-500"; }
                  else if (successRate >= 50) { cellBg = "bg-amber-500/80"; hoverBorder = "hover:border-amber-300"; }
                  else if (successRate >= 0) { cellBg = "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.15)]"; hoverBorder = "hover:border-rose-300 animate-pulse-short"; }
                  const isSelected = selectedEndpointFilter === `${ep.method} ${ep.endpoint}`;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        if (isSelected) { setSelectedEndpointFilter(null); }
                        else { setSelectedEndpointFilter(`${ep.method} ${ep.endpoint}`); setActiveTab("explorer"); }
                      }}
                      className={`h-9 w-9 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all border text-[8px] font-bold outline-none ${isSelected ? 'border-white scale-105 shadow-md shadow-white/10 ring-1 ring-white/30' : 'border-transparent ' + hoverBorder} ${cellBg} text-white`}
                      title={`${ep.method} ${ep.endpoint} - Passed: ${ep.passed}/${ep.total - ep.skipped} (${successRate >= 0 ? successRate.toFixed(0) + '%' : 'Skipped'})`}
                    >
                      <span className="opacity-70 text-[7px] leading-none uppercase font-mono">{ep.method.slice(0, 3)}</span>
                      <span className="leading-none mt-0.5 font-mono font-black">{ep.passed}/{ep.total - ep.skipped}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-panel rounded-2xl p-5 shadow-lg border-white/[0.04] bg-[#05070c]/35 glow-card-hover">
                <h3 className="text-[10px] font-bold text-slate-450 uppercase tracking-widest mb-4 font-mono">Overall Results Distribution</h3>
                <div className="h-56 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" outerRadius={75} innerRadius={45} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {pieData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: "#05070c", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", fontSize: "10px", fontFamily: "monospace", color: "#f3f4f6" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
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
                        <XAxis type="number" stroke={chartAxisStroke} tick={chartAxisTick} />
                        <YAxis type="category" dataKey="name" stroke={chartAxisStroke} tick={chartAxisTick} width={110} />
                        <Tooltip contentStyle={{ backgroundColor: "#05070c", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", fontSize: "10px", fontFamily: "monospace", color: "#f3f4f6" }} />
                        <Bar dataKey="avg" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-56 flex items-center justify-center text-slate-600 font-mono text-xs select-none">No tested latency metrics to display.</div>
                )}
              </div>
            </div>

            {categoryChartData.length > 0 && (
              <div className="glass-panel rounded-2xl p-5 shadow-lg border-white/[0.04] bg-[#05070c]/35 glow-card-hover">
                <h3 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-4 font-mono">Results by Test Category</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryChartData} margin={{ left: 4, right: 12, bottom: 8, top: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="name" stroke={chartAxisStroke} tick={chartAxisTick} interval={0} axisLine={{ stroke: chartAxisStroke }} tickLine={{ stroke: chartAxisStroke }} />
                      <YAxis stroke={chartAxisStroke} tick={chartAxisTick} axisLine={{ stroke: chartAxisStroke }} tickLine={{ stroke: chartAxisStroke }} />
                      <Tooltip contentStyle={{ backgroundColor: "#05070c", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", fontSize: "10px", fontFamily: "monospace", color: "#f3f4f6" }} />
                      <Bar dataKey="passed" stackId="a" fill="#10b981" name="Passed" />
                      <Bar dataKey="failed" stackId="a" fill="#f43f5e" name="Failed" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

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
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded leading-none ${getMethodBadgeClass(ep.method)}`}>{ep.method}</span>
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

        {/* ──── TAB 2: AI WATCHDOG ──── */}
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
            {/* Filters */}
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
                <select value={explorerStatus} onChange={(e) => setExplorerStatus(e.target.value as any)} className="bg-slate-950 border border-white/[0.06] rounded-xl px-3 py-2 text-slate-350 text-xs focus:outline-none focus:border-blue-500/50 font-semibold">
                  <option value="all">All Statuses</option>
                  <option value="PASS">PASS</option>
                  <option value="FAIL">FAIL</option>
                  <option value="ERROR">ERROR</option>
                  <option value="SKIPPED">SKIPPED</option>
                </select>
                <select value={explorerCategory} onChange={(e) => setExplorerCategory(e.target.value)} className="bg-slate-950 border border-white/[0.06] rounded-xl px-3 py-2 text-slate-350 text-xs focus:outline-none focus:border-blue-500/50 font-semibold">
                  <option value="all">All Categories</option>
                  {categoriesList.map((c) => (<option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>))}
                </select>
              </div>
            </div>

            {selectedEndpointFilter && (
              <div className="bg-blue-950/20 border border-blue-900/40 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-blue-350 shadow-md animate-fadeIn">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                  <span>Filtered explorer by endpoint: <strong>{selectedEndpointFilter}</strong></span>
                </div>
                <button onClick={() => setSelectedEndpointFilter(null)} className="text-xs text-blue-400 hover:text-blue-300 font-bold underline cursor-pointer select-none">
                  Clear Filter
                </button>
              </div>
            )}

            {/* Split Screen */}
            <div className="flex-1 flex gap-4 min-h-0">
              {/* Left Pane */}
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
                          className={`w-full p-2.5 rounded-xl transition-all border text-left flex items-center gap-3 outline-none ${isSelected ? 'bg-blue-600/10 border-blue-500/30 shadow shadow-blue-900/5 ring-1 ring-blue-500/20' : 'bg-transparent border-transparent hover:bg-slate-900/20'}`}
                        >
                          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                          <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded leading-none flex-shrink-0 font-mono ${getMethodBadgeClass(t.method)}`}>{t.method.slice(0, 3)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-[10px] font-bold text-slate-200 truncate tracking-tight">{t.path}</div>
                            <div className="text-[9px] text-slate-500 truncate mt-0.5 font-medium">{t.testName.replace(`${t.method} ${t.path} — `, "")}</div>
                          </div>
                          <span className="text-[9px] font-mono text-slate-500 flex-shrink-0">{t.responseTime}ms</span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="text-center py-16 font-mono text-[10px] text-slate-600 select-none">No logs found matching criteria.</div>
                  )}
                </div>
              </div>

              {/* Right Pane */}
              <div className="flex-1 glass-panel rounded-2xl overflow-hidden flex flex-col min-h-0 border-white/[0.04] bg-[#05070c]/35 shadow-lg">
                {!selectedTest ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-650 font-mono">
                    <Braces className="h-8 w-8 text-slate-800 mb-3 animate-pulse" />
                    <p className="text-xs font-bold">No Audit Log Selected</p>
                    <p className="text-[9px] text-slate-600 mt-1 max-w-xs leading-relaxed">Select any test case from the left panel to inspect requests, payloads, headers, and AI fixes.</p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="bg-[#05070c]/60 border-b border-white/[0.04] p-4 flex items-center justify-between gap-3 flex-shrink-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded leading-none font-mono ${getMethodBadgeClass(selectedTest.method)}`}>{selectedTest.method}</span>
                          <span className="font-mono text-xs font-bold text-white truncate tracking-tight select-all">{selectedTest.path}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5 truncate leading-none font-semibold">{selectedTest.testName}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[8px] uppercase font-bold tracking-widest px-2 py-1 rounded ${statusConfig[selectedTest.status].label}`}>{selectedTest.status}</span>
                        <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-950/60 px-2 py-1 rounded border border-white/[0.05] flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-500" />
                          {selectedTest.responseTime}ms
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                      <div className="bg-[#05070c]/50 border border-white/[0.04] p-3.5 rounded-xl flex gap-3 shadow-inner">
                        <Info className="h-4.5 w-4.5 text-blue-455 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[8px] uppercase tracking-widest font-extrabold text-slate-500 block font-mono">Validation Objective</span>
                          <p className="text-[11px] text-slate-300 leading-relaxed font-sans mt-0.5">{selectedTest.description}</p>
                        </div>
                      </div>

                      {selectedTest.errorMessage && (
                        <div className="bg-rose-955/10 border border-rose-900/50 rounded-xl p-3.5 flex gap-3 shadow">
                          <AlertTriangle className="h-4.5 w-4.5 text-rose-500 flex-shrink-0 mt-0.5 animate-bounce-short" />
                          <div className="space-y-1">
                            <span className="text-[8px] uppercase tracking-widest font-extrabold text-rose-400 font-mono">Diagnostic Exception Error</span>
                            <p className="text-xs text-rose-300 font-mono break-all leading-normal">{selectedTest.errorMessage}</p>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                              <pre className="bg-[#040608] px-3.5 py-3 rounded-xl border border-white/[0.04] font-mono text-[9px] text-slate-400 overflow-auto whitespace-pre leading-relaxed max-h-32 scrollbar-thin">{buildCurl(selectedTest)}</pre>
                            </div>
                          </div>
                        </div>

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
                                <div className="bg-slate-950 p-2.5 rounded-lg border border-white/[0.04] font-mono text-sm font-bold text-slate-400 shadow-inner">{selectedTest.expected.join(" OR ")}</div>
                              </div>
                            </div>
                            <div>
                              <span className="text-[8px] text-slate-500 uppercase font-bold tracking-widest block mb-1.5 font-mono">Response Body Payload</span>
                              {selectedTest.responseBody !== null && selectedTest.responseBody !== undefined ? (
                                <JsonBlock data={selectedTest.responseBody} />
                              ) : (
                                <div className="text-slate-500 italic text-[9px] font-mono p-3 bg-slate-950/40 rounded-xl border border-white/[0.03] select-none shadow-inner">
                                  {selectedTest.status === "PASS" ? "— Response payload omitted for passed checks —" : "— Empty response body —"}
                                </div>
                              )}
                            </div>
                            <div>
                              <span className="text-[8px] text-slate-500 uppercase font-bold tracking-widest block mb-1.5 font-mono">Response Headers</span>
                              <ResponseHeadersTable headers={selectedTest.responseHeaders} responseTime={selectedTest.responseTime} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ── Schema Diff ────────────────────────────────── */}
                      {selectedTest.schemaDiff && (
                        <div className="bg-[#05070c]/50 border border-white/[0.05] rounded-2xl p-4 space-y-3 shadow-lg">
                          <div className="flex items-center gap-2 border-b border-white/[0.04] pb-2">
                            <GitCompare className="h-4 w-4 text-cyan-400" />
                            <span className="text-[9px] font-bold text-white tracking-widest uppercase font-mono">
                              Schema Diff
                            </span>
                            <span className={`ml-auto text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full font-mono ${selectedTest.schemaDiff.hasIssues ? 'bg-rose-950/60 text-rose-300 border border-rose-800/50' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'}`}>
                              {selectedTest.schemaDiff.hasIssues ? `${selectedTest.schemaDiff.diffs.length} issue${selectedTest.schemaDiff.diffs.length !== 1 ? 's' : ''}` : 'contract ok'}
                            </span>
                          </div>
                          {selectedTest.schemaDiff.hasIssues ? (
                            <div className="font-mono text-[10px] rounded-lg overflow-hidden border border-white/[0.04]">
                              {/* header row */}
                              <div className="grid grid-cols-[16px_1fr_80px_80px] gap-x-3 px-3 py-1.5 bg-slate-950/60 text-[8px] uppercase tracking-widest text-slate-500 font-bold border-b border-white/[0.04]">
                                <span></span>
                                <span>Field</span>
                                <span>Expected</span>
                                <span>Actual</span>
                              </div>
                              {selectedTest.schemaDiff.diffs.map((d, i) => {
                                const cfg: Record<string, { glyph: string; rowCls: string; glyphCls: string }> = {
                                  missing:          { glyph: '−', rowCls: 'bg-rose-950/20 hover:bg-rose-950/30',    glyphCls: 'text-rose-400' },
                                  extra:            { glyph: '+', rowCls: 'bg-sky-950/20 hover:bg-sky-950/30',      glyphCls: 'text-sky-400' },
                                  wrong_type:       { glyph: '~', rowCls: 'bg-amber-950/20 hover:bg-amber-950/30', glyphCls: 'text-amber-400' },
                                  null_unexpected:  { glyph: '∅', rowCls: 'bg-orange-950/20 hover:bg-orange-950/30', glyphCls: 'text-orange-400' },
                                };
                                const { glyph, rowCls, glyphCls } = cfg[d.change] ?? cfg.extra;
                                return (
                                  <div key={i} className={`grid grid-cols-[16px_1fr_80px_80px] gap-x-3 px-3 py-1.5 transition-colors ${rowCls} ${i < selectedTest.schemaDiff!.diffs.length - 1 ? 'border-b border-white/[0.03]' : ''}`}>
                                    <span className={`font-bold select-none ${glyphCls}`}>{glyph}</span>
                                    <span className="text-slate-200 truncate" title={d.field}>{d.field}</span>
                                    <span className="text-slate-400 truncate">{d.expected ?? '—'}</span>
                                    <span className="text-slate-400 truncate">{d.actual ?? d.change === 'missing' ? 'absent' : '—'}</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-[10px] text-emerald-400/70 font-mono">
                              Response body matches the OpenAPI schema contract.
                            </p>
                          )}
                          <p className="text-[8px] text-slate-600 font-mono">
                            − missing required field &nbsp;·&nbsp; + extra undeclared field &nbsp;·&nbsp; ~ type mismatch &nbsp;·&nbsp; ∅ null on non-nullable
                          </p>
                        </div>
                      )}

                      {selectedTestHasFailed && (
                        <div className="bg-[#05070c]/50 border border-white/[0.05] rounded-2xl p-4 space-y-3.5 shadow-lg glow-card-hover">
                          <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-purple-400" />
                              <span className="text-[9px] font-bold text-white tracking-widest uppercase font-mono">Failure Diagnostics</span>
                            </div>
                            {onRequestRootCause && !rootCause?.loading && (
                              <button
                                onClick={triggerDiagnostic}
                                className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1.5 bg-purple-650 hover:bg-purple-600 text-white rounded-lg transition-all active:scale-[0.98] shadow-md outline-none"
                              >
                                <Cpu className="h-3.5 w-3.5" />
                                <span>{rootCause?.text ? 'Re-run AI' : 'Deepen with AI'}</span>
                              </button>
                            )}
                          </div>
                          {activeDiagnostic && (
                            <div className="p-4 bg-slate-950 border border-white/[0.04] rounded-xl text-xs space-y-2 text-slate-300">
                              <p><strong className="text-white">Likely cause:</strong> {activeDiagnostic.likelyCause}</p>
                              <p><strong className="text-white">Suggested fix:</strong> {activeDiagnostic.suggestedFix}</p>
                              <p className="text-[9px] text-slate-500 font-mono pt-1 border-t border-white/[0.04]">
                                {activeDiagnostic.severity.toUpperCase()} • Owner: {activeDiagnostic.ownerHint} • {activeDiagnostic.source} engine
                                {aiDiagnostic ? ' (Gemini verified)' : ' (rule-based)'}
                              </p>
                            </div>
                          )}
                          {rootCause && (
                            <div className="space-y-2">
                              {rootCause.loading ? (
                                <div className="space-y-2 py-2 animate-pulse">
                                  <div className="h-3 bg-slate-900 rounded w-1/3"></div>
                                  <div className="h-2 bg-slate-900 rounded w-full"></div>
                                  <div className="h-2 bg-slate-900 rounded w-5/6"></div>
                                </div>
                              ) : rootCause.text ? (
                                <div className="p-4 bg-slate-950/80 border border-purple-900/30 rounded-xl font-sans leading-relaxed text-slate-300 shadow-inner">
                                  <span className="text-[8px] uppercase font-bold text-purple-400 tracking-widest block mb-2">AI narrative</span>
                                  <MarkdownBlock text={rootCause.text} />
                                </div>
                              ) : !activeDiagnostic ? (
                                <span className="text-[9px] text-rose-400 font-mono">Diagnostics unavailable — check GEMINI_API_KEY or retry.</span>
                              ) : null}
                            </div>
                          )}
                          {!activeDiagnostic && !rootCause && (
                            <p className="text-[10px] text-slate-500">Select a failed test — rule engine insights appear automatically when available.</p>
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

        {/* Footer */}
        {/* ──── TAB 4: REGRESSION DIFF ──── */}
        {activeTab === "regression" && report.regressionDiff && (
          <div className="space-y-5">
            <div className="glass-panel rounded-2xl p-5 shadow-lg border border-white/[0.04] bg-[#05070c]/35">
              <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-white/[0.04]">
                <GitCompare className="h-4.5 w-4.5 text-purple-400" />
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-tight">Regression Diff</h3>
                  <p className="text-[9px] text-slate-400">{report.regressionDiff.summary}</p>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-3">
                  <div className="text-2xl font-black font-mono text-rose-400">{report.regressionDiff.newlyFailing.length}</div>
                  <div className="text-[9px] uppercase font-bold text-slate-400 mt-1">New Failures</div>
                </div>
                <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3">
                  <div className="text-2xl font-black font-mono text-emerald-400">{report.regressionDiff.newlyPassing.length}</div>
                  <div className="text-[9px] uppercase font-bold text-slate-400 mt-1">Fixed</div>
                </div>
                <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-3">
                  <div className="text-2xl font-black font-mono text-amber-400">{report.regressionDiff.statusChanged.length}</div>
                  <div className="text-[9px] uppercase font-bold text-slate-400 mt-1">Status Changed</div>
                </div>
              </div>

              {/* New failures */}
              {report.regressionDiff.newlyFailing.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5" /> New Failures
                  </h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {report.regressionDiff.newlyFailing.map((d, i) => (
                      <div key={i} className="bg-rose-950/10 border border-rose-900/30 rounded-lg px-3 py-2 text-[10px] font-mono">
                        <span className="text-rose-300 font-bold">{d.key}</span>
                        <span className="text-slate-500 ml-2">{d.before.status} → {d.after.status} (was {d.before.actual}, now {d.after.actual})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fixed */}
              {report.regressionDiff.newlyPassing.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Fixed Tests
                  </h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {report.regressionDiff.newlyPassing.map((d, i) => (
                      <div key={i} className="bg-emerald-950/10 border border-emerald-900/30 rounded-lg px-3 py-2 text-[10px] font-mono">
                        <span className="text-emerald-300 font-bold">{d.key}</span>
                        <span className="text-slate-500 ml-2">{d.before.status} → {d.after.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status changed */}
              {report.regressionDiff.statusChanged.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" /> Status Code Changes
                  </h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {report.regressionDiff.statusChanged.map((d, i) => (
                      <div key={i} className="bg-amber-950/10 border border-amber-900/30 rounded-lg px-3 py-2 text-[10px] font-mono">
                        <span className="text-amber-300 font-bold">{d.key}</span>
                        <span className="text-slate-500 ml-2">{d.before.actual} → {d.after.actual}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.regressionDiff.newlyFailing.length === 0 &&
               report.regressionDiff.newlyPassing.length === 0 &&
               report.regressionDiff.statusChanged.length === 0 && (
                <div className="text-center py-8 text-emerald-400 font-bold text-sm">
                  ✅ No regressions — {report.regressionDiff.unchanged} tests unchanged
                </div>
              )}
            </div>
          </div>
        )}

        {/* ──── TAB 5: FLAKINESS ──── */}

        {/* ──── TAB 5: FLAKINESS ──── */}
        {activeTab === "flakiness" && report.flakiness && (
          <div className="space-y-5">
            <div className="glass-panel rounded-2xl p-5 shadow-lg border border-white/[0.04] bg-[#05070c]/35">
              <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-white/[0.04]">
                <TrendingDown className="h-4 w-4 text-amber-400" />
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-tight">Flakiness Analysis</h3>
                  <p className="text-[9px] text-slate-400">Failed tests were re-run 5x to distinguish consistent failures from non-deterministic (flaky) behaviour.</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: "Stable", value: report.flakiness.stableCount, color: "text-emerald-400", bg: "bg-emerald-950/30 border-emerald-800/40" },
                  { label: "Flaky", value: report.flakiness.flakyCount, color: "text-amber-400", bg: "bg-amber-950/30 border-amber-800/40" },
                  { label: "Highly Flaky", value: report.flakiness.highlyFlakyCount, color: "text-rose-400", bg: "bg-rose-950/30 border-rose-800/40" },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`rounded-xl p-3 border ${bg} text-center`}>
                    <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
                    <div className="text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {report.flakiness.entries.map((entry) => {
                  const scoreColor = entry.score === "STABLE" ? "text-emerald-400 bg-emerald-950/30 border-emerald-800/40"
                    : entry.score === "FLAKY" ? "text-amber-400 bg-amber-950/30 border-amber-800/40"
                    : "text-rose-400 bg-rose-950/30 border-rose-800/40";
                  return (
                    <div key={entry.testKey} className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/40 border border-white/[0.04]">
                      <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border font-mono ${scoreColor}`}>{entry.score.replace("_", " ")}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-white font-medium truncate">{entry.testName}</p>
                        <p className="text-[9px] text-slate-500 font-mono">{entry.method} {entry.path}</p>
                      </div>
                      <div className="flex gap-0.5">
                        {entry.runResults.map((passed, i) => (
                          <div key={i} className={`w-2 h-2 rounded-full ${passed ? "bg-emerald-500" : "bg-rose-500"}`} title={`Run ${i + 1}: ${passed ? "PASS" : "FAIL"}`} />
                        ))}
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono">{entry.passCount}/{entry.runResults.length}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}


        {/* ──── TAB 6: OWASP SECURITY ──── */}
        {activeTab === "security" && report.securityProbes && (() => {
          const sec = report.securityProbes;
          const scoreColor =
            sec.score >= 80 ? "text-emerald-400" :
            sec.score >= 50 ? "text-amber-400"   :
                              "text-rose-400";
          const scoreBg =
            sec.score >= 80 ? "bg-emerald-950/30 border-emerald-800/40" :
            sec.score >= 50 ? "bg-amber-950/30 border-amber-800/40"     :
                              "bg-rose-950/30 border-rose-800/40";

          const SEVERITY_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
            critical: { label: "Critical", color: "text-rose-300",   bg: "bg-rose-950/40 border-rose-700/40",   dot: "bg-rose-500"   },
            high:     { label: "High",     color: "text-orange-300", bg: "bg-orange-950/40 border-orange-700/40", dot: "bg-orange-500" },
            medium:   { label: "Medium",   color: "text-amber-300",  bg: "bg-amber-950/40 border-amber-700/40",  dot: "bg-amber-500"  },
            low:      { label: "Low",      color: "text-sky-300",    bg: "bg-sky-950/40 border-sky-700/40",      dot: "bg-sky-500"    },
            info:     { label: "Info",     color: "text-slate-400",  bg: "bg-slate-900/40 border-slate-700/40",  dot: "bg-slate-500"  },
          };

          const vulnerabilities = sec.findings.filter((f) => !f.passed);
          const passed          = sec.findings.filter((f) => f.passed);

          return (
            <div className="space-y-5">
              {/* Score header */}
              <div className="glass-panel rounded-2xl p-5 shadow-lg border border-white/[0.04] bg-[#05070c]/35">
                <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-white/[0.04]">
                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-tight">OWASP API Security Top 10</h3>
                    <p className="text-[9px] text-slate-400">
                      Automated probes scanned {sec.totalProbes} checks across injection, mass assignment, CORS, rate-limiting, security headers and verbose error leakage.
                    </p>
                  </div>
                  <div className="ml-auto text-[9px] text-slate-500 font-mono">
                    {new Date(sec.scannedAt).toLocaleTimeString()}
                  </div>
                </div>

                {/* KPI row */}
                <div className="grid grid-cols-4 gap-3 mb-5">
                  <div className={`rounded-xl p-3 border ${scoreBg} text-center`}>
                    <div className={`text-3xl font-bold font-mono ${scoreColor}`}>{sec.score}</div>
                    <div className="text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">Security Score</div>
                  </div>
                  <div className="rounded-xl p-3 border bg-rose-950/30 border-rose-800/40 text-center">
                    <div className="text-2xl font-bold font-mono text-rose-400">{sec.criticalCount}</div>
                    <div className="text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">Critical</div>
                  </div>
                  <div className="rounded-xl p-3 border bg-orange-950/30 border-orange-800/40 text-center">
                    <div className="text-2xl font-bold font-mono text-orange-400">{sec.highCount}</div>
                    <div className="text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">High</div>
                  </div>
                  <div className="rounded-xl p-3 border bg-amber-950/30 border-amber-800/40 text-center">
                    <div className="text-2xl font-bold font-mono text-amber-400">{sec.mediumCount}</div>
                    <div className="text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">Medium</div>
                  </div>
                </div>

                {/* Score explanation bar */}
                <div className="mb-1 flex justify-between text-[9px] text-slate-500">
                  <span>0 — At risk</span>
                  <span>100 — Secure</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${sec.score >= 80 ? "bg-emerald-500" : sec.score >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                    style={{ width: `${sec.score}%` }}
                  />
                </div>
              </div>

              {/* Vulnerabilities */}
              {vulnerabilities.length > 0 && (
                <div className="glass-panel rounded-2xl p-5 shadow-lg border border-white/[0.04] bg-[#05070c]/35">
                  <h4 className="text-xs font-bold text-white uppercase tracking-tight mb-3">
                    Vulnerabilities Found ({vulnerabilities.length})
                  </h4>
                  <div className="space-y-3">
                    {vulnerabilities.map((f) => {
                      const meta = SEVERITY_META[f.severity] ?? SEVERITY_META.info;
                      return (
                        <div key={f.id} className={`rounded-xl p-4 border ${meta.bg}`}>
                          <div className="flex items-start gap-3">
                            <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${meta.dot}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${meta.color}`}>
                                  {meta.label}
                                </span>
                                <span className="text-[9px] text-slate-500 font-mono bg-slate-900/60 px-1.5 py-0.5 rounded">
                                  {f.owaspCategory}
                                </span>
                                <span className="text-[9px] text-slate-500 font-mono">{f.endpoint}</span>
                              </div>
                              <p className="text-[11px] font-semibold text-white mb-1">{f.title}</p>
                              <p className="text-[10px] text-slate-300 mb-2">{f.detail}</p>
                              {f.evidence && (
                                <pre className="text-[9px] font-mono text-slate-400 bg-slate-950/60 rounded-lg px-3 py-2 overflow-x-auto mb-2 border border-white/[0.04]">{f.evidence}</pre>
                              )}
                              <div className="flex items-start gap-1.5">
                                <span className="text-[9px] text-cyan-400 font-bold flex-shrink-0">Fix:</span>
                                <span className="text-[9px] text-slate-400">{f.recommendation}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Passed probes */}
              {passed.length > 0 && (
                <div className="glass-panel rounded-2xl p-5 shadow-lg border border-white/[0.04] bg-[#05070c]/35">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-tight mb-3">
                    Probes Passed ({passed.length})
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {passed.map((f) => (
                      <div key={f.id} className="flex items-center gap-3 rounded-xl p-3 bg-emerald-950/20 border border-emerald-800/30">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] text-emerald-300 font-semibold">{f.title}</span>
                          <span className="text-[9px] text-slate-500 ml-2 font-mono">{f.endpoint}</span>
                        </div>
                        <span className="text-[9px] text-slate-500 font-mono bg-slate-900/60 px-1.5 py-0.5 rounded flex-shrink-0">
                          {f.owaspCategory}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ──── FOOTER ──── */}
        <div className="pt-6 pb-10 border-t border-white/[0.04] mt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-[9px] text-slate-600 font-mono space-y-0.5">
              <p>SwaggerPilot v2 &mdash; Automated OpenAPI Audit Engine</p>
              <p>Report generated {new Date(report.completedAt).toLocaleString()} &mdash; {report.durationMs}ms</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => exportToExcel(report)} className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-slate-300 rounded-lg transition-all">
                <FileArchive className="h-3 w-3" /> Excel
              </button>
              <button onClick={() => exportToCsv(report)} className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-slate-300 rounded-lg transition-all">
                <FileArchive className="h-3 w-3" /> CSV
              </button>
              <button onClick={() => exportToJson(report)} className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-slate-300 rounded-lg transition-all">
                <Package className="h-3 w-3" /> JSON
              </button>
              <button onClick={() => exportToPdf(report, 'report-pdf-export')} className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-slate-300 rounded-lg transition-all">
                <FileArchive className="h-3 w-3" /> PDF
              </button>
              <button onClick={() => exportClientPdf(report)} className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-slate-300 rounded-lg transition-all">
                <Briefcase className="h-3 w-3" /> Client PDF
              </button>
              <button onClick={() => exportFailedTestsToPostman(report)} className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-slate-300 rounded-lg transition-all">
                <Package className="h-3 w-3" /> Postman
              </button>
              <button onClick={() => exportTestCode(report)} className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 bg-emerald-900/50 hover:bg-emerald-800/50 border border-emerald-700/40 text-emerald-300 rounded-lg transition-all">
                <Package className="h-3 w-3" /> Export Java
              </button>
              <button onClick={() => exportClientPack(report)} className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 bg-indigo-900/60 hover:bg-indigo-800/60 border border-indigo-700/40 text-indigo-300 rounded-lg transition-all">
                <Briefcase className="h-3 w-3" /> Client Pack
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
