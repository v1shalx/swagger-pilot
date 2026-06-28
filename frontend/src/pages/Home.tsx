/**
 * @file Home.tsx
 * @description Audit Cockpit — the primary configuration view for SwaggerPilot.
 *
 * Responsibilities:
 *  - Accept a Swagger/OpenAPI spec URL and optional base URL override
 *  - Configure authentication (Bearer, API Key, Basic Auth, Auto Login)
 *  - Select a run profile (Smoke | Full) and toggle optional test modules
 *  - Render the discovered endpoint list for fine-grained selection
 *  - Emit a fully-typed {@link RunTestsConfig} to the parent on launch
 *
 * Design decisions:
 *  - Only "Automated Suite" mode is supported. Manual CSV import and Combined
 *    modes were removed to keep the demo surface small and reliable.
 *  - Dry Run was removed (low signal, confuses interviewers). Use the endpoint
 *    selector instead if you want to limit scope.
 */

import React, { useState } from "react";
import { RunTestsConfig } from "../types";
import {
  Play,
  ShieldAlert,
  Sparkles,
  Sliders,
  Globe,
  Lock,
  Flame,
  Key,
  Shield,
  UserCheck,
  Zap,
  Layers,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HomeProps {
  /** Called when the user clicks "Execute API Audit". */
  onRunTests: (config: RunTestsConfig) => void;
  /** Whether a test run is currently in progress. */
  isRunning: boolean;
  /**
   * Endpoints discovered after the spec is parsed.
   * Passed back from the WebSocket so users can deselect specific paths.
   */
  allEndpoints?: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Pre-loaded Swagger spec presets so reviewers can demo without an own API. */
const SAMPLE_URLS = [
  {
    label: "Swagger 2.0",
    url: "https://petstore.swagger.io/v2/swagger.json",
    base: "https://petstore.swagger.io/v2",
  },
  {
    label: "OpenAPI 3.0",
    url: "https://petstore3.swagger.io/api/v3/openapi.json",
    base: "https://petstore3.swagger.io/api/v3",
  },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Home({ onRunTests, isRunning, allEndpoints = [] }: HomeProps) {
  // ── Form state ────────────────────────────────────────────────────────────
  const [config, setConfig] = useState<RunTestsConfig>({
    swaggerUrl: "",
    baseUrl: "",
    authType: "none",
    authValue: "",
    apiKeyName: "X-API-Key",
    apiKeyLocation: "header",
    loginUrl: "",
    loginUsername: "",
    loginPassword: "",
    delayBetweenTests: 150,
    skipAiGeneration: false,
    runProfile: "full",
    runChainTests: true,
    runIdorTests: false,
  });

  // ── Endpoint selection state (Feature 1) ─────────────────────────────────
  const [selectedEndpoints, setSelectedEndpoints] = useState<Set<string>>(new Set());
  const [endpointSelectAll, setEndpointSelectAll] = useState(true);

  /** Sync selection set whenever the parsed endpoint list arrives. */
  React.useEffect(() => {
    if (allEndpoints.length > 0) {
      setSelectedEndpoints(new Set(allEndpoints));
      setEndpointSelectAll(true);
    }
  }, [allEndpoints]);

  /** Toggle a single endpoint's inclusion in the run. */
  const toggleEndpoint = (ep: string) => {
    setSelectedEndpoints((prev) => {
      const next = new Set(prev);
      if (next.has(ep)) {
        next.delete(ep);
      } else {
        next.add(ep);
      }
      setEndpointSelectAll(next.size === allEndpoints.length);
      return next;
    });
  };

  /** Select or deselect all discovered endpoints at once. */
  const toggleSelectAll = () => {
    if (endpointSelectAll) {
      setSelectedEndpoints(new Set());
      setEndpointSelectAll(false);
    } else {
      setSelectedEndpoints(new Set(allEndpoints));
      setEndpointSelectAll(true);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** True when SwaggerPilot can initiate a run. */
  const canRun = () => config.swaggerUrl.trim() !== "";

  const isLocalUrl =
    config.swaggerUrl.includes("localhost") || config.swaggerUrl.includes("127.0.0.1");

  /** Load a preset spec URL + base URL pair into the form. */
  const loadSample = (sample: (typeof SAMPLE_URLS)[number]) => {
    setConfig((c) => ({ ...c, swaggerUrl: sample.url, baseUrl: sample.base }));
  };

  /**
   * One-click demo: loads the Petstore Swagger 2 spec and immediately fires a
   * Smoke run (no AI, reduced delay) so reviewers see results in ~10 seconds.
   */
  const runDemoAudit = () => {
    const sample = SAMPLE_URLS[0];
    setConfig((c) => ({
      ...c,
      swaggerUrl: sample.url,
      baseUrl: sample.base,
      runProfile: "smoke",
      skipAiGeneration: true,
      authType: "none",
    }));
    // Small tick so React flushes config before the socket emits
    setTimeout(() => {
      onRunTests({
        swaggerUrl: sample.url,
        baseUrl: sample.base,
        authType: "none",
        runProfile: "smoke",
        skipAiGeneration: true,
        delayBetweenTests: 80,
      });
    }, 100);
  };

  /** Compile the form state into a {@link RunTestsConfig} and emit upward. */
  const handleSubmit = () => {
    if (!canRun()) {
      alert("Please enter a Swagger / OpenAPI spec URL.");
      return;
    }

    // Only pass selectedEndpoints if the user has deselected at least one
    const chosenEndpoints =
      allEndpoints.length > 0 && !endpointSelectAll
        ? Array.from(selectedEndpoints)
        : undefined;

    onRunTests({ ...config, selectedEndpoints: chosenEndpoints } as any);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen text-slate-100 font-sans antialiased relative">

      {/* ── Top navigation bar ── */}
      <header className="border-b border-white/[0.04] bg-[#05070c]/50 backdrop-blur-md sticky top-0 z-40">
        <div className="w-full px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Flame className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="font-black text-xs text-white tracking-tight leading-none uppercase">
                SWAGGER<span className="text-blue-500">PILOT</span>
              </span>
              <span className="ml-2 text-[9px] uppercase font-bold tracking-widest px-2.5 py-1 rounded bg-slate-950/80 text-slate-400 border border-white/[0.04]">
                API Test Runner
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-white/[0.04] shadow">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">
              Engine Ready
            </span>
          </div>
        </div>
      </header>

      <main className="w-full px-6 py-8 space-y-6 relative z-10">

        {/* ── Hero headline ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-600/10 border border-blue-500/20 text-blue-400 text-[10px] uppercase font-extrabold tracking-wider">
              <Zap className="h-3 w-3" />
              <span>Automated API Audit</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none">
              Paste your OpenAPI spec. Get a full API audit in minutes.
            </h1>
            <p className="text-slate-400 text-xs font-medium max-w-xl">
              SwaggerPilot generates 100+ test cases from your spec — boundary, auth,
              contract, chain, and AI-edge-case scenarios — runs them live, and produces a
              release-readiness report.
            </p>
            {/* One-click demo button for interviewers */}
            <button
              type="button"
              onClick={runDemoAudit}
              disabled={isRunning}
              className="mt-3 flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-blue-900/30 transition-all"
            >
              <Play className="h-4 w-4 fill-white" />
              Run demo audit (Petstore)
            </button>
          </div>
        </div>

        {/* ── Section 1: Spec URL ── */}
        <div className="glass-panel rounded-2xl p-5 shadow-xl relative overflow-hidden border border-white/[0.04] glow-card-hover bg-[#05070c]/35">
          <div className="absolute top-0 right-0 w-80 h-32 bg-blue-500/5 blur-3xl rounded-full pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-4 border-b border-white/[0.04]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex-shrink-0">
                <Globe className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-white tracking-tight uppercase">
                  1. Target API Specification
                </h3>
                <p className="text-[9px] text-slate-500">
                  Provide the OpenAPI / Swagger JSON or YAML spec URL. Auto-detects JSON
                  from Swagger UI HTML pages.
                </p>
              </div>
            </div>

            {/* Preset loaders */}
            <div className="flex gap-2 items-center flex-wrap">
              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 mr-1">
                Load preset:
              </span>
              {SAMPLE_URLS.map((s) => (
                <button
                  key={s.url}
                  onClick={() => loadSample(s)}
                  className="text-[9px] uppercase font-bold tracking-wider bg-slate-900/60 hover:bg-slate-800 text-blue-400 hover:text-blue-300 px-2.5 py-1 rounded-lg transition-all font-mono border border-white/[0.05] shadow"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
                OpenAPI Spec URL
              </label>
              <input
                type="text"
                placeholder="https://api.yoursite.com/openapi.json  or  /api/docs"
                value={config.swaggerUrl}
                onChange={(e) => setConfig((c) => ({ ...c, swaggerUrl: e.target.value }))}
                className="w-full bg-slate-950 border border-white/[0.06] rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 font-mono text-xs shadow-inner"
              />
            </div>
            <div>
              <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
                Base URL Override{" "}
                <span className="text-slate-600 normal-case font-medium">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="http://localhost:3000/v1"
                value={config.baseUrl}
                onChange={(e) => setConfig((c) => ({ ...c, baseUrl: e.target.value }))}
                className="w-full bg-slate-950 border border-white/[0.06] rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 font-mono text-xs shadow-inner"
              />
            </div>
          </div>

          {/* Localhost CORS warning */}
          {isLocalUrl && (
            <div className="mt-3 flex items-start gap-2.5 bg-amber-950/10 border border-amber-900/40 rounded-xl px-4 py-2 text-amber-300 text-[10px] shadow">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Localhost detected:</strong> Ensure your
                API server allows CORS from the browser, or that the backend proxy is
                reachable.
              </div>
            </div>
          )}
        </div>

        {/* ── Section 1b: Endpoint selector (rendered after spec is parsed) ── */}
        {allEndpoints.length > 0 && (
          <div className="glass-panel rounded-2xl p-5 shadow-xl relative overflow-hidden border border-white/[0.04] glow-card-hover bg-[#05070c]/35 animate-fadeIn">
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/[0.04]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex-shrink-0">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-white tracking-tight uppercase">
                    Endpoint Scope Filter
                  </h3>
                  <p className="text-[9px] text-slate-500">
                    {selectedEndpoints.size} / {allEndpoints.length} endpoints selected
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg bg-slate-900/60 border border-white/[0.06] text-slate-400 hover:text-white transition-colors"
              >
                {endpointSelectAll ? "Deselect All" : "Select All"}
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-thin pr-1">
              {allEndpoints.map((ep) => {
                const [method, ...pathParts] = ep.split(" ");
                const path = pathParts.join(" ");
                const isChecked = selectedEndpoints.has(ep);
                /** Colour-code by HTTP verb for quick scanning */
                const methodColor: Record<string, string> = {
                  GET: "text-blue-400",
                  POST: "text-green-400",
                  PUT: "text-yellow-400",
                  DELETE: "text-red-400",
                  PATCH: "text-orange-400",
                };
                return (
                  <label
                    key={ep}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-900/40 cursor-pointer group transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleEndpoint(ep)}
                      className="accent-blue-500 w-3.5 h-3.5 flex-shrink-0 rounded"
                    />
                    <span
                      className={`text-[10px] font-black font-mono w-14 flex-shrink-0 ${
                        methodColor[method] || "text-slate-400"
                      }`}
                    >
                      {method}
                    </span>
                    <span className="text-[10px] font-mono text-slate-300 group-hover:text-white transition-colors truncate">
                      {path}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Sections 2 + 3: Two-column cockpit ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Section 2: Authentication ── */}
          <div className="glass-panel rounded-2xl p-5 shadow-lg space-y-4 glow-card-hover">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-white/[0.04] pb-2.5">
              <Lock className="h-3.5 w-3.5 text-blue-400" />
              2. Authentication
            </h3>

            {/* Auth type selector grid */}
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { type: "none",      label: "No Auth",      icon: Shield    },
                  { type: "bearer",    label: "Bearer Token", icon: Key       },
                  { type: "apikey",    label: "API Key",      icon: Lock      },
                  { type: "basic",     label: "Basic Auth",   icon: UserCheck },
                  { type: "autologin", label: "Auto Login",   icon: Sparkles  },
                ] as const
              ).map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setConfig((c) => ({ ...c, authType: type as any }))}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-semibold border transition-all justify-start outline-none ${
                    config.authType === type
                      ? "bg-blue-600/10 border-blue-500/40 text-blue-400 shadow-md shadow-blue-900/10"
                      : "bg-slate-950/20 border-white/[0.04] text-slate-400 hover:text-slate-300 hover:bg-slate-900/30"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>

            {/* Contextual credential fields */}
            <div className="pt-2 space-y-3.5">

              {/* Bearer token */}
              {config.authType === "bearer" && (
                <div className="space-y-1.5 animate-fadeIn">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
                    JWT / Bearer Token
                  </label>
                  <textarea
                    placeholder="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={config.authValue}
                    rows={5}
                    onChange={(e) => setConfig((c) => ({ ...c, authValue: e.target.value }))}
                    className="w-full bg-slate-950 border border-white/[0.06] rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 font-mono text-[10px] resize-none leading-relaxed"
                  />
                </div>
              )}

              {/* API key */}
              {config.authType === "apikey" && (
                <div className="space-y-3.5 animate-fadeIn">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                        Header / Query Name
                      </label>
                      <input
                        type="text"
                        placeholder="X-API-Key"
                        value={config.apiKeyName}
                        onChange={(e) => setConfig((c) => ({ ...c, apiKeyName: e.target.value }))}
                        className="w-full bg-slate-950 border border-white/[0.06] rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 font-mono text-[10px]"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                        Transport
                      </label>
                      <select
                        value={config.apiKeyLocation}
                        onChange={(e) =>
                          setConfig((c) => ({ ...c, apiKeyLocation: e.target.value as any }))
                        }
                        className="w-full bg-slate-950 border border-white/[0.06] rounded-xl px-2.5 py-2 text-slate-300 focus:outline-none focus:border-blue-500/50 text-[10px] font-semibold"
                      >
                        <option value="header">HTTP Header</option>
                        <option value="query">URL Query Param</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                      Key Value
                    </label>
                    <input
                      type="text"
                      placeholder="Enter your API key"
                      value={config.authValue}
                      onChange={(e) => setConfig((c) => ({ ...c, authValue: e.target.value }))}
                      className="w-full bg-slate-950 border border-white/[0.06] rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 font-mono text-[10px]"
                    />
                  </div>
                </div>
              )}

              {/* Basic auth */}
              {config.authType === "basic" && (
                <div className="animate-fadeIn">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                    Credentials (username:password)
                  </label>
                  <input
                    type="text"
                    placeholder="admin:secret"
                    value={config.authValue}
                    onChange={(e) => setConfig((c) => ({ ...c, authValue: e.target.value }))}
                    className="w-full bg-slate-950 border border-white/[0.06] rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 font-mono text-[10px]"
                  />
                </div>
              )}

              {/* Auto Login — hits a POST /login endpoint and extracts the JWT */}
              {config.authType === "autologin" && (
                <div className="space-y-3.5 animate-fadeIn">
                  <div>
                    <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                      Login Endpoint URL
                    </label>
                    <input
                      type="text"
                      placeholder="https://api.yourapp.com/auth/login"
                      value={config.loginUrl}
                      onChange={(e) => setConfig((c) => ({ ...c, loginUrl: e.target.value }))}
                      className="w-full bg-slate-950 border border-white/[0.06] rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 font-mono text-[10px]"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                        Username / Email
                      </label>
                      <input
                        type="text"
                        placeholder="admin@example.com"
                        value={config.loginUsername}
                        onChange={(e) =>
                          setConfig((c) => ({ ...c, loginUsername: e.target.value }))
                        }
                        className="w-full bg-slate-950 border border-white/[0.06] rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 text-[10px]"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={config.loginPassword}
                        onChange={(e) =>
                          setConfig((c) => ({ ...c, loginPassword: e.target.value }))
                        }
                        className="w-full bg-slate-950 border border-white/[0.06] rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 text-[10px]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* No auth placeholder */}
              {config.authType === "none" && (
                <div className="text-center py-10 text-slate-500 font-mono text-[10px] space-y-2 bg-[#05070c]/50 rounded-2xl border border-white/[0.03]">
                  <Shield className="h-6 w-6 text-slate-600 mx-auto animate-pulse" />
                  <p>Running in unauthenticated mode.</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Section 3: Audit Modifiers ── */}
          <div className="glass-panel rounded-2xl p-5 shadow-lg space-y-4 glow-card-hover">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-white/[0.04] pb-2.5">
              <Sliders className="h-3.5 w-3.5 text-blue-400" />
              3. Audit Modifiers
            </h3>

            <div className="space-y-4 text-xs">

              {/* Rate-limiting throttle */}
              <div className="border-b border-white/[0.04] pb-3.5">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="text-xs font-bold text-slate-300">Rate-Limit Delay</h4>
                  <span className="text-[10px] font-mono text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                    {config.delayBetweenTests}ms
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1000}
                  step={10}
                  value={config.delayBetweenTests}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, delayBetweenTests: Number(e.target.value) }))
                  }
                  className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <p className="text-[9px] text-slate-500 mt-1">
                  Throttle between requests — increase for rate-limited APIs.
                </p>
              </div>

              {/* Run profile */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 mb-2">Run Profile</h4>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      {
                        id: "smoke" as const,
                        label: "Smoke",
                        desc: "Auth + happy path — fast CI gate",
                      },
                      {
                        id: "full" as const,
                        label: "Full Audit",
                        desc: "All rules + AI edge-cases",
                      },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setConfig((c) => ({
                          ...c,
                          runProfile: p.id,
                          // Smoke always skips AI to keep runtime short
                          skipAiGeneration: p.id === "smoke" ? true : c.skipAiGeneration,
                        }))
                      }
                      className={`rounded-xl p-2.5 text-left border transition-all outline-none ${
                        config.runProfile === p.id
                          ? "bg-blue-600/15 border-blue-500/40 shadow-md"
                          : "bg-slate-950/40 border-white/[0.04] hover:border-white/[0.08]"
                      }`}
                    >
                      <div
                        className={`text-[10px] font-bold ${
                          config.runProfile === p.id ? "text-blue-300" : "text-slate-400"
                        }`}
                      >
                        {p.label}
                      </div>
                      <p className="text-[8px] text-slate-500 mt-0.5">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Skip AI edge-cases toggle */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-300">Skip AI Edge-Cases</h4>
                  <p className="text-[9px] text-slate-500 mt-0.5">
                    Disables Gemini generation (Full profile only).
                  </p>
                </div>
                <button
                  type="button"
                  disabled={config.runProfile === "smoke"}
                  onClick={() =>
                    setConfig((c) => ({ ...c, skipAiGeneration: !c.skipAiGeneration }))
                  }
                  className={`w-10 h-5 rounded-full transition-all relative flex items-center flex-shrink-0 outline-none custom-switch ${
                    config.skipAiGeneration || config.runProfile === "smoke"
                      ? "bg-blue-600"
                      : "bg-slate-800"
                  } ${config.runProfile === "smoke" ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full transition-transform absolute ${
                      config.skipAiGeneration || config.runProfile === "smoke"
                        ? "right-0.5"
                        : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Chain tests toggle (Feature 2) */}
              <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/[0.04]">
                <div>
                  <h4 className="text-xs font-bold text-slate-300">🔗 Chain Tests</h4>
                  <p className="text-[9px] text-slate-500 mt-0.5">
                    Auto-generate create → read → delete flows from the spec.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConfig((c) => ({ ...c, runChainTests: !c.runChainTests }))
                  }
                  className={`w-10 h-5 rounded-full transition-all relative flex items-center flex-shrink-0 outline-none custom-switch ${
                    config.runChainTests ? "bg-blue-600" : "bg-slate-800"
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full transition-transform absolute ${
                      config.runChainTests ? "right-0.5" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* IDOR / AuthZ tests toggle (Feature 3) */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-red-400">
                    🚨 IDOR / AuthZ Tests
                  </h4>
                  <p className="text-[9px] text-slate-500 mt-0.5">
                    Requires a second user identity (User B credentials below).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConfig((c) => ({ ...c, runIdorTests: !c.runIdorTests }))
                  }
                  className={`w-10 h-5 rounded-full transition-all relative flex items-center flex-shrink-0 outline-none custom-switch ${
                    config.runIdorTests ? "bg-red-600" : "bg-slate-800"
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full transition-transform absolute ${
                      config.runIdorTests ? "right-0.5" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* OWASP Security Probes toggle */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-cyan-400">
                    🛡️ OWASP Security Probes
                  </h4>
                  <p className="text-[9px] text-slate-500 mt-0.5">
                    Injection, mass assignment, CORS, rate-limit &amp; header checks.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConfig((c) => ({ ...c, runSecurityProbes: !c.runSecurityProbes }))
                  }
                  className={`w-10 h-5 rounded-full transition-all relative flex items-center flex-shrink-0 outline-none custom-switch ${
                    config.runSecurityProbes ? "bg-cyan-600" : "bg-slate-800"
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full transition-transform absolute ${
                      config.runSecurityProbes ? "right-0.5" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* User B credentials — only visible when IDOR is on */}
              {config.runIdorTests && (
                <div className="space-y-2.5 pt-2 border-t border-red-900/30 animate-fadeIn">
                  <p className="text-[9px] text-red-400 font-bold uppercase tracking-wider">
                    User B (Second Identity)
                  </p>
                  <div>
                    <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                      Auth Type
                    </label>
                    <select
                      value={config.secondAuthType || "bearer"}
                      onChange={(e) =>
                        setConfig((c) => ({ ...c, secondAuthType: e.target.value as any }))
                      }
                      className="w-full bg-slate-950 border border-white/[0.06] rounded-xl px-2.5 py-2 text-slate-300 text-[10px] focus:outline-none focus:border-red-500/50"
                    >
                      <option value="bearer">Bearer Token</option>
                      <option value="autologin">Auto Login</option>
                      <option value="apikey">API Key</option>
                    </select>
                  </div>

                  {(!config.secondAuthType || config.secondAuthType === "bearer") && (
                    <div>
                      <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                        Bearer Token (User B)
                      </label>
                      <input
                        type="text"
                        placeholder="Bearer eyJ..."
                        value={config.secondAuthValue || ""}
                        onChange={(e) =>
                          setConfig((c) => ({ ...c, secondAuthValue: e.target.value }))
                        }
                        className="w-full bg-slate-950 border border-red-900/30 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-red-500/50 font-mono text-[10px]"
                      />
                    </div>
                  )}

                  {config.secondAuthType === "autologin" && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Login URL (User B)"
                        value={config.secondLoginUrl || ""}
                        onChange={(e) =>
                          setConfig((c) => ({ ...c, secondLoginUrl: e.target.value }))
                        }
                        className="w-full bg-slate-950 border border-red-900/30 rounded-xl px-3 py-1.5 text-white font-mono text-[10px] focus:outline-none"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Username B"
                          value={config.secondLoginUsername || ""}
                          onChange={(e) =>
                            setConfig((c) => ({ ...c, secondLoginUsername: e.target.value }))
                          }
                          className="bg-slate-950 border border-red-900/30 rounded-xl px-3 py-1.5 text-white text-[10px] focus:outline-none"
                        />
                        <input
                          type="password"
                          placeholder="Password B"
                          value={config.secondLoginPassword || ""}
                          onChange={(e) =>
                            setConfig((c) => ({ ...c, secondLoginPassword: e.target.value }))
                          }
                          className="bg-slate-950 border border-red-900/30 rounded-xl px-3 py-1.5 text-white text-[10px] focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Launch bar ── */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-white/[0.04]">
          <button
            onClick={handleSubmit}
            disabled={isRunning || !canRun()}
            className="flex-1 flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all text-sm shadow-xl shadow-blue-500/10 active:scale-[0.99] outline-none relative overflow-hidden group"
          >
            <Play className="h-4 w-4 fill-white flex-shrink-0" />
            <span className="relative z-10 font-bold tracking-wide uppercase text-xs">
              {isRunning ? "Audit In Progress..." : "Execute API Audit"}
            </span>
            {/* Shimmer sweep animation */}
            <div className="absolute inset-0 w-1/2 h-full bg-white/10 skew-x-12 translate-x-[-100%] group-hover:translate-x-[250%] transition-transform duration-1000 ease-out" />
          </button>
        </div>

      </main>
    </div>
  );
}
