import React, { useState } from "react";
import { TestResult, METHOD_COLORS, CATEGORY_LABELS } from "../types";

interface TestCardProps {
  result: TestResult;
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
      className="text-xs px-2 py-0.5 rounded bg-slate-600 hover:bg-slate-500 text-slate-300 hover:text-white transition-colors flex-shrink-0"
    >
      {copied ? "✅ Copied" : "📋 Copy"}
    </button>
  );
}

// Formatted JSON block with copy
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
      <div className="text-slate-500 italic text-xs px-3 py-2">— No body —</div>
    );
  }

  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <CopyButton text={formatted} />
      </div>
      <pre className="bg-[#0d1117] border border-slate-700 rounded-lg px-4 py-3 font-mono text-xs text-green-300 overflow-auto max-h-64 whitespace-pre-wrap break-all leading-5">
        {formatted}
      </pre>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
      {children}
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

function statusText(code: number | null): string {
  if (!code) return "";
  const map: Record<number, string> = {
    200: "OK",
    201: "Created",
    204: "No Content",
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    409: "Conflict",
    422: "Unprocessable Entity",
    429: "Too Many Requests",
    500: "Internal Server Error",
  };
  return map[code] || "";
}

export default function TestCard({ result }: TestCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"request" | "response">("request");

  const borderColor = {
    PASS: "border-l-4 border-l-green-500 bg-green-500/5",
    FAIL: "border-l-4 border-l-red-500 bg-red-500/5",
    ERROR: "border-l-4 border-l-orange-500 bg-orange-500/5",
    SKIPPED: "border-l-4 border-l-slate-500 bg-slate-500/5",
  };

  const statusPill = {
    PASS: "bg-green-600 text-white",
    FAIL: "bg-red-600 text-white",
    ERROR: "bg-orange-600 text-white",
    SKIPPED: "bg-slate-600 text-white",
  };

  const codeColor = (code: number | null) => {
    if (!code) return "text-slate-400";
    if (code < 300) return "text-green-400";
    if (code < 400) return "text-blue-400";
    if (code < 500) return "text-yellow-400";
    return "text-red-400";
  };

  const curl = buildCurl(result);
  const shortName = result.testName.replace(
    `${result.method} ${result.path} — `,
    "",
  );

  return (
    <div
      className={`rounded-lg mb-2 border border-slate-700/60 overflow-hidden ${borderColor[result.status]}`}
    >
      {/* ── HEADER ROW ── */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-white/5 transition-colors select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded text-white flex-shrink-0 ${METHOD_COLORS[result.method] || "bg-gray-500"}`}
        >
          {result.method}
        </span>
        <span className="font-mono text-xs text-slate-200 flex-shrink-0">
          {result.path}
        </span>
        <span className="text-xs bg-slate-700/80 text-slate-300 px-1.5 py-0.5 rounded flex-shrink-0">
          {CATEGORY_LABELS[result.category] || result.category}
        </span>
        {result.isAiGenerated && (
          <span className="text-xs bg-purple-800/60 text-purple-300 px-1.5 py-0.5 rounded flex-shrink-0">
            🤖 AI
          </span>
        )}
        <span className="text-xs text-slate-400 truncate flex-1 min-w-0">
          — {shortName}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          {result.actual !== null && (
            <span
              className={`font-mono font-bold text-sm ${codeColor(result.actual)}`}
            >
              {result.actual}
            </span>
          )}
          <span
            className={`text-xs px-2 py-0.5 rounded font-bold ${statusPill[result.status]}`}
          >
            {result.status}
          </span>
          <span className="text-xs text-slate-500">
            {result.responseTime}ms
          </span>
          <span className="text-slate-500 text-xs w-3">
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {/* ── EXPANDED PANEL ── */}
      {expanded && (
        <div className="border-t border-slate-700/60">
          {/* Tab bar */}
          <div className="flex bg-slate-800/80 border-b border-slate-700/60">
            {(["request", "response"] as const).map((tab) => (
              <button
                key={tab}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTab(tab);
                }}
                className={`px-6 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors ${
                  activeTab === tab
                    ? "text-blue-400 border-b-2 border-blue-400 bg-slate-900/50"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab === "request" ? "📤 Request" : "📥 Response"}
              </button>
            ))}
          </div>

          <div className="p-5 space-y-6 bg-slate-900/40">
            {/* ════ REQUEST TAB ════ */}
            {activeTab === "request" && (
              <>
                {/* Curl */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <SectionLabel>Curl</SectionLabel>
                    <CopyButton text={curl} />
                  </div>
                  <pre className="bg-[#0d1117] border border-slate-700 rounded-lg px-4 py-3 font-mono text-xs text-green-300 overflow-auto whitespace-pre leading-5">
                    {curl}
                  </pre>
                </div>

                {/* Request URL */}
                <div>
                  <SectionLabel>Request URL</SectionLabel>
                  <div className="flex items-center gap-3 bg-[#0d1117] border border-slate-700 rounded-lg px-4 py-3">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded text-white flex-shrink-0 ${METHOD_COLORS[result.method] || "bg-gray-500"}`}
                    >
                      {result.method}
                    </span>
                    <span className="font-mono text-sm text-blue-300 break-all flex-1">
                      {result.fullUrl}
                    </span>
                    <CopyButton text={result.fullUrl} />
                  </div>
                </div>

                {/* Request Headers */}
                <div>
                  <SectionLabel>Request Headers</SectionLabel>
                  <div className="bg-[#0d1117] border border-slate-700 rounded-lg overflow-hidden">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="border-b border-slate-700/60 bg-slate-800/40">
                          <th className="px-4 py-2 text-left text-slate-400 font-semibold w-48">
                            Header
                          </th>
                          <th className="px-4 py-2 text-left text-slate-400 font-semibold">
                            Value
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-700/30">
                          <td className="px-4 py-2 text-purple-300">accept</td>
                          <td className="px-4 py-2 text-green-300">*/*</td>
                        </tr>
                        <tr className="border-b border-slate-700/30">
                          <td className="px-4 py-2 text-purple-300">
                            Content-Type
                          </td>
                          <td className="px-4 py-2 text-green-300">
                            application/json
                          </td>
                        </tr>
                        {result.category === "auth" &&
                        result.testName.includes("No auth") ? (
                          <tr>
                            <td className="px-4 py-2 text-purple-300">
                              Authorization
                            </td>
                            <td className="px-4 py-2 text-slate-500 italic">
                              — not sent (no-auth test scenario) —
                            </td>
                          </tr>
                        ) : result.category === "auth" &&
                          result.testName.includes("Invalid") ? (
                          <tr>
                            <td className="px-4 py-2 text-purple-300">
                              Authorization
                            </td>
                            <td className="px-4 py-2 text-yellow-300">
                              Bearer invalid_token_abc123xyz
                            </td>
                          </tr>
                        ) : (
                          <tr>
                            <td className="px-4 py-2 text-purple-300">
                              Authorization
                            </td>
                            <td className="px-4 py-2 text-green-300">
                              Bearer [your-valid-token]
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Request Body */}
                <div>
                  <SectionLabel>Request Body</SectionLabel>
                  {result.requestBody !== null &&
                  result.requestBody !== undefined ? (
                    <JsonBlock data={result.requestBody} />
                  ) : (
                    <div className="bg-[#0d1117] border border-slate-700 rounded-lg px-4 py-3 text-xs text-slate-500 italic">
                      — No request body ({result.method} request) —
                    </div>
                  )}
                </div>

                {/* Test Purpose */}
                <div>
                  <SectionLabel>Test Purpose</SectionLabel>
                  <div className="bg-[#0d1117] border border-slate-700 rounded-lg px-4 py-3 text-xs text-slate-300 leading-relaxed">
                    {result.description}
                  </div>
                </div>
              </>
            )}

            {/* ════ RESPONSE TAB ════ */}
            {activeTab === "response" && (
              <>
                {/* Status code row */}
                <div>
                  <SectionLabel>Server Response</SectionLabel>
                  <div className="bg-[#0d1117] border border-slate-700 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-700/60 bg-slate-800/40">
                          <th className="px-4 py-2 text-left text-slate-400 font-semibold">
                            Code
                          </th>
                          <th className="px-4 py-2 text-left text-slate-400 font-semibold">
                            Description
                          </th>
                          <th className="px-4 py-2 text-left text-slate-400 font-semibold">
                            Result
                          </th>
                          <th className="px-4 py-2 text-right text-slate-400 font-semibold">
                            Time
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="px-4 py-3">
                            <span
                              className={`font-mono font-bold text-2xl ${codeColor(result.actual)}`}
                            >
                              {result.actual ?? "N/A"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {statusText(result.actual)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs px-2 py-1 rounded font-bold ${statusPill[result.status]}`}
                            >
                              {result.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-400">
                            {result.responseTime}ms
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Expected vs Actual */}
                <div>
                  <SectionLabel>Expected vs Actual</SectionLabel>
                  <div className="bg-[#0d1117] border border-slate-700 rounded-lg overflow-hidden">
                    <table className="w-full text-xs font-mono">
                      <tbody>
                        <tr className="border-b border-slate-700/30">
                          <td className="px-4 py-2.5 text-slate-400 w-32">
                            Expected
                          </td>
                          <td className="px-4 py-2.5 text-blue-300 font-bold">
                            {result.expected.join(" or ")}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2.5 text-slate-400">Got</td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`font-bold text-sm ${codeColor(result.actual)}`}
                            >
                              {result.actual ?? "N/A"}
                            </span>
                            {result.status === "PASS" ? (
                              <span className="text-green-400 ml-3">
                                ✅ Match — test passed
                              </span>
                            ) : (
                              <span className="text-red-400 ml-3">
                                ❌ Mismatch — test failed
                              </span>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Failure reason */}
                {result.errorMessage && (
                  <div>
                    <SectionLabel>⚠️ Failure Reason</SectionLabel>
                    <div className="bg-red-950/50 border border-red-800/60 rounded-lg px-4 py-3 text-xs text-red-300 leading-relaxed">
                      {result.errorMessage}
                    </div>
                  </div>
                )}

                {/* Response Body */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <SectionLabel>Response Body</SectionLabel>
                  </div>
                  {result.responseBody !== null &&
                  result.responseBody !== undefined ? (
                    <JsonBlock data={result.responseBody} />
                  ) : (
                    <div className="bg-[#0d1117] border border-slate-700 rounded-lg px-4 py-3 text-xs text-slate-500 italic">
                      {result.status === "PASS"
                        ? "— Response body not stored for passed tests —"
                        : "— No response body received —"}
                    </div>
                  )}
                </div>

                {/* Response Headers */}
                <div>
                  <SectionLabel>Response Headers</SectionLabel>
                  <div className="bg-[#0d1117] border border-slate-700 rounded-lg overflow-hidden">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="border-b border-slate-700/60 bg-slate-800/40">
                          <th className="px-4 py-2 text-left text-slate-400 font-semibold w-56">
                            Header
                          </th>
                          <th className="px-4 py-2 text-left text-slate-400 font-semibold">
                            Value
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ["content-type", "application/json; charset=utf-8"],
                          ["access-control-allow-credentials", "true"],
                          ["access-control-allow-origin", "*"],
                          ["x-response-time", `${result.responseTime}ms`],
                        ].map(([key, val]) => (
                          <tr
                            key={key}
                            className="border-b border-slate-700/30 last:border-0"
                          >
                            <td className="px-4 py-2 text-purple-300">{key}</td>
                            <td className="px-4 py-2 text-green-300">{val}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
