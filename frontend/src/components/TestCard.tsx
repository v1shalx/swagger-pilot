import React, { useState } from "react";
import { TestResult, METHOD_COLORS, CATEGORY_LABELS } from "../types";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  SkipForward, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Sparkles, 
  Clock, 
  Globe, 
  Cpu, 
  ArrowRight
} from "lucide-react";

interface TestCardProps {
  result: TestResult;
  rootCauses?: Record<string, { loading: boolean; text: string | null }>;
  onRequestRootCause?: (testKey: string, result: TestResult) => void;
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
      className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all font-sans font-bold uppercase tracking-wider"
    >
      <Copy className="h-2.5 w-2.5" />
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
      <div className="text-slate-500 italic text-[11px] font-mono p-2 bg-slate-950/40 rounded border border-slate-900">— No body —</div>
    );
  }

  return (
    <div className="relative group rounded-lg overflow-hidden border border-slate-850">
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <CopyButton text={formatted} />
      </div>
      <pre className="bg-[#05070a] px-3 py-2 font-mono text-[11px] text-green-400 overflow-auto max-h-48 whitespace-pre-wrap break-all leading-relaxed">
        {formatted}
      </pre>
    </div>
  );
}

function renderBoldText(text: string) {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="font-bold text-white">{part}</strong> : part);
}

function MarkdownBlock({ text }: { text: string }) {
  if (!text) return null;
  
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-xs leading-relaxed font-sans text-slate-350">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('###')) {
          return <h4 key={idx} className="text-xs font-bold text-white uppercase tracking-wider mt-3 mb-1">{trimmed.replace(/^###\s*/, '')}</h4>;
        }
        if (trimmed.startsWith('##')) {
          return <h3 key={idx} className="text-sm font-extrabold text-blue-400 mt-4 mb-2">{trimmed.replace(/^##\s*/, '')}</h3>;
        }
        if (trimmed.startsWith('#')) {
          return <h2 key={idx} className="text-base font-black text-white mt-4 mb-2">{trimmed.replace(/^#\s*/, '')}</h2>;
        }
        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          const content = trimmed.replace(/^[-*]\s*/, '');
          return (
            <div key={idx} className="flex gap-2 pl-1.5">
              <span className="text-blue-500 font-bold">•</span>
              <span>{renderBoldText(content)}</span>
            </div>
          );
        }
        if (/^\d+\./.test(trimmed)) {
          const content = trimmed.replace(/^\d+\.\s*/, '');
          return (
            <div key={idx} className="flex gap-2 pl-1.5">
              <span className="text-blue-400 font-mono font-bold">{trimmed.match(/^\d+\./)?.[0]}</span>
              <span>{renderBoldText(content)}</span>
            </div>
          );
        }
        return <p key={idx} className="min-h-[1em]">{renderBoldText(line)}</p>;
      })}
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

export default function TestCard({ result, rootCauses, onRequestRootCause }: TestCardProps) {
  const [expanded, setExpanded] = useState(false);

  const statusConfig = {
    PASS: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-950/10 border-l-2 border-emerald-500", pill: "bg-emerald-500/10 text-emerald-450 border border-emerald-500/20" },
    FAIL: { icon: XCircle, color: "text-rose-500", bg: "bg-rose-950/10 border-l-2 border-rose-500", pill: "bg-rose-500/10 text-rose-450 border border-rose-500/20" },
    ERROR: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-950/10 border-l-2 border-amber-500", pill: "bg-amber-500/10 text-amber-450 border border-amber-500/20" },
    SKIPPED: { icon: SkipForward, color: "text-slate-500", bg: "bg-slate-900/40 border-l-2 border-slate-600", pill: "bg-slate-800 text-slate-400 border border-slate-700/50" }
  };

  const codeColor = (code: number | null) => {
    if (!code) return "text-slate-500";
    if (code < 300) return "text-emerald-400";
    if (code < 400) return "text-blue-400";
    if (code < 500) return "text-amber-400";
    return "text-rose-400";
  };

  const curl = buildCurl(result);
  const shortName = result.testName.replace(`${result.method} ${result.path} — `, "");
  const testKey = `${result.method}-${result.path}-${result.testName}`;
  const rootCause = rootCauses?.[testKey];
  const hasFailed = result.status === 'FAIL' || result.status === 'ERROR';

  const cfg = statusConfig[result.status];
  const StatusIcon = cfg.icon;

  const triggerDiagnostic = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRequestRootCause) {
      onRequestRootCause(testKey, result);
    }
  };

  return (
    <div className={`rounded-lg border border-slate-850 hover:border-slate-800 transition-colors overflow-hidden select-none mb-1.5 ${cfg.bg}`}>
      {/* collapsed view */}
      <div 
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-900/40 transition-colors"
      >
        <StatusIcon className={`h-4 w-4 flex-shrink-0 ${cfg.color}`} />
        <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded leading-none ${METHOD_COLORS[result.method] || 'bg-slate-700'} text-white flex-shrink-0`}>
          {result.method}
        </span>
        <span className="font-mono text-xs text-slate-200 truncate font-medium">
          {result.path}
        </span>
        <span className="text-[10px] text-slate-500">•</span>
        <span className="text-xs text-slate-450 truncate flex-1 font-sans">
          {shortName}
        </span>
        <div className="flex items-center gap-3 ml-auto flex-shrink-0">
          <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
            {CATEGORY_LABELS[result.category] || result.category}
          </span>
          {result.isAiGenerated && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-950/20 text-purple-400 border border-purple-900/20 flex items-center gap-1">
              <Cpu className="h-2.5 w-2.5" />
              AI
            </span>
          )}
          {result.actual !== null && (
            <span className={`font-mono text-xs font-bold ${codeColor(result.actual)}`}>
              {result.actual}
            </span>
          )}
          <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {result.responseTime}ms
          </span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-slate-500" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-500" />}
        </div>
      </div>

      {/* expanded view */}
      {expanded && (
        <div className="border-t border-slate-850 p-4 bg-slate-950/50 space-y-4">
          
          {/* Failure Alert Box */}
          {result.errorMessage && (
            <div className="bg-rose-950/10 border border-rose-900/50 rounded-lg p-3 flex gap-2">
              <AlertTriangle className="h-4.5 w-4.5 text-rose-450 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-rose-400">Error Diagnostics</span>
                <p className="text-xs text-rose-300 font-mono break-all">{result.errorMessage}</p>
              </div>
            </div>
          )}

          {/* REQUEST VS RESPONSE COMPARISON PANEL */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* Outgoing Request Side */}
            <div className="space-y-3 bg-slate-900/30 p-3 rounded-lg border border-slate-850">
              <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                <h4 className="text-[10px] uppercase font-extrabold tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-blue-400" />
                  Outgoing Request Telemetry
                </h4>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1">Target Resource URL</span>
                  <div className="bg-slate-950 p-2 rounded border border-slate-900 font-mono text-[11px] break-all text-blue-400 flex items-center justify-between gap-2">
                    <span className="truncate">{result.fullUrl}</span>
                    <CopyButton text={result.fullUrl} />
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1">Request Payload (JSON Body)</span>
                  <JsonBlock data={result.requestBody} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">CURL Command Equivalent</span>
                    <CopyButton text={curl} />
                  </div>
                  <pre className="bg-[#05070a] px-3 py-2 rounded-lg border border-slate-850 font-mono text-[11px] text-slate-400 overflow-auto whitespace-pre leading-relaxed max-h-32">
                    {curl}
                  </pre>
                </div>
              </div>
            </div>

            {/* Incoming Response Side */}
            <div className="space-y-3 bg-slate-900/30 p-3 rounded-lg border border-slate-850">
              <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                <h4 className="text-[10px] uppercase font-extrabold tracking-widest text-slate-400 flex items-center gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5 text-emerald-400" />
                  Incoming Response Telemetry
                </h4>
              </div>

              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">HTTP Response Code</span>
                    <div className="bg-slate-950 p-2 rounded border border-slate-900 font-mono text-base font-bold flex items-center gap-2">
                      <span className={codeColor(result.actual)}>{result.actual ?? "N/A"}</span>
                      <span className="text-xs text-slate-400 font-medium">({result.status})</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Expected Codes</span>
                    <div className="bg-slate-950 p-2 rounded border border-slate-900 font-mono text-base font-bold text-slate-300">
                      {result.expected.join(" OR ")}
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1">Response Body (JSON Payload)</span>
                  {result.responseBody !== null && result.responseBody !== undefined ? (
                    <JsonBlock data={result.responseBody} />
                  ) : (
                    <div className="text-slate-550 italic text-[11px] font-mono p-2 bg-slate-950/40 rounded border border-slate-900">
                      {result.status === "PASS"
                        ? "— Response body not stored for passed tests —"
                        : "— No response body received —"}
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1">Standard Headers</span>
                  <div className="bg-slate-950 rounded border border-slate-900 overflow-hidden">
                    <table className="w-full text-[10px] font-mono text-left">
                      <tbody>
                        <tr className="border-b border-slate-900">
                          <td className="px-2 py-1 text-slate-500 font-bold uppercase tracking-wider w-24">Content-Type</td>
                          <td className="px-2 py-1 text-slate-300">application/json; charset=utf-8</td>
                        </tr>
                        <tr>
                          <td className="px-2 py-1 text-slate-500 font-bold uppercase tracking-wider">Latency</td>
                          <td className="px-2 py-1 text-slate-350">{result.responseTime}ms</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* AI ROOT CAUSE DIAGNOSTICS */}
          {hasFailed && onRequestRootCause && (
            <div className="bg-slate-900/40 border border-slate-850 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  <span className="text-xs font-bold text-white tracking-tight uppercase">AI Root Cause Diagnostics</span>
                </div>
                {!rootCause && (
                  <button
                    onClick={triggerDiagnostic}
                    className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded transition-all active:scale-[0.98] shadow-md shadow-purple-900/10"
                  >
                    <Cpu className="h-3 w-3" />
                    <span>Run AI Diagnostics</span>
                  </button>
                )}
              </div>

              {rootCause && (
                <div className="space-y-2">
                  {rootCause.loading ? (
                    <div className="space-y-2 py-2 animate-pulse">
                      <div className="h-3 bg-slate-800 rounded w-1/3"></div>
                      <div className="h-2 bg-slate-800 rounded w-full"></div>
                      <div className="h-2 bg-slate-800 rounded w-5/6"></div>
                      <div className="h-2 bg-slate-800 rounded w-4/5"></div>
                    </div>
                  ) : rootCause.text ? (
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-900 font-sans leading-relaxed">
                      <MarkdownBlock text={rootCause.text} />
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">Diagnostics failed to execute.</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Test Case Purpose description */}
          <div className="bg-slate-900/10 border border-slate-850 p-2.5 rounded-lg text-xs leading-normal">
            <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-450 block mb-1">Validation Objective</span>
            <span className="text-slate-350 text-[11px] font-medium leading-relaxed font-sans">{result.description}</span>
          </div>
        </div>
      )}
    </div>
  );
}
