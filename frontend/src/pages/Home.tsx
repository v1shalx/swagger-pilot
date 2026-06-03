import React, { useState } from "react";
import { RunTestsConfig } from "../types";
import CustomTestUpload from "../components/CustomTestUpload";
import { 
  Play, 
  Settings, 
  ShieldAlert, 
  Sparkles, 
  Sliders, 
  Globe, 
  Lock, 
  Eye, 
  HelpCircle, 
  Layers, 
  FileCode,
  Flame,
  Key,
  Shield,
  UserCheck,
  Zap
} from "lucide-react";

interface HomeProps {
  onRunTests: (config: RunTestsConfig) => void;
  onDryRun: (config: RunTestsConfig) => void;
  dryRunResult: any;
  isRunning: boolean;
}

const SAMPLE_URLS = [
  {
    label: "Petstore (Swagger 2.0)",
    url: "https://petstore.swagger.io/v2/swagger.json",
    base: "https://petstore.swagger.io/v2",
  },
  {
    label: "Petstore (OpenAPI 3.0)",
    url: "https://petstore3.swagger.io/api/v3/openapi.json",
    base: "https://petstore3.swagger.io/api/v3",
  },
];

type Mode = "auto" | "manual" | "both";

export default function Home({
  onRunTests,
  onDryRun,
  dryRunResult,
  isRunning,
}: HomeProps) {
  const [mode, setMode] = useState<Mode>("auto");
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
    runProfile: 'full',
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customTestsContent, setCustomTestsContent] = useState<string | null>(
    null,
  );
  const [customTestsType, setCustomTestsType] = useState<"json" | "csv">("csv");
  const [customTestsCount, setCustomTestsCount] = useState(0);

  const isLocalUrl =
    config.swaggerUrl.includes("localhost") ||
    config.swaggerUrl.includes("127.0.0.1");

  const canRun = () => {
    if (mode === "auto") return config.swaggerUrl.trim() !== "";
    if (mode === "manual")
      return config.baseUrl.trim() !== "" && customTestsCount > 0;
    if (mode === "both")
      return config.swaggerUrl.trim() !== "" && customTestsCount > 0;
    return false;
  };

  const handleSubmit = () => {
    if (!canRun()) {
      if (mode === "manual" && !config.baseUrl.trim()) {
        alert("Please enter a Base URL (e.g. http://localhost:3003)");
        return;
      }
      if (mode === "manual" && customTestsCount === 0) {
        alert("Please upload a CSV/JSON/Excel test file");
        return;
      }
      if (mode === "both" && !config.swaggerUrl.trim()) {
        alert("Please enter a Swagger URL");
        return;
      }
      if (mode === "both" && customTestsCount === 0) {
        alert("Please upload a test file for Both mode");
        return;
      }
      return;
    }

    onRunTests({
      ...config,
      swaggerUrl: mode === "manual" ? "__manual_only__" : config.swaggerUrl,
      customTests: customTestsContent || undefined,
      customTestsType: customTestsContent ? customTestsType : undefined,
    } as any);
  };

  const handleDryRun = () => {
    if (!config.swaggerUrl.trim() && mode !== "manual") {
      alert("Please enter a Swagger URL");
      return;
    }
    onDryRun(config);
  };

  const loadSample = (sample: (typeof SAMPLE_URLS)[0]) => {
    setConfig((c) => ({ ...c, swaggerUrl: sample.url, baseUrl: sample.base }));
  };

  const runDemoAudit = () => {
    const sample = SAMPLE_URLS[0];
    setMode('auto');
    setConfig((c) => ({
      ...c,
      swaggerUrl: sample.url,
      baseUrl: sample.base,
      runProfile: 'smoke',
      skipAiGeneration: true,
      authType: 'none',
    }));
    setTimeout(() => {
      onRunTests({
        swaggerUrl: sample.url,
        baseUrl: sample.base,
        authType: 'none',
        runProfile: 'smoke',
        skipAiGeneration: true,
        delayBetweenTests: 80,
      });
    }, 100);
  };

  const modeConfig = {
    auto: {
      label: "Automated Suite",
      desc: "Instant parser generating comprehensive boundary, type, and AI validation schedules.",
      borderColor: "border-blue-500/20",
      activeBg: "bg-blue-600/10 border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.12)]",
      accentText: "text-blue-400 font-bold",
      icon: Layers
    },
    manual: {
      label: "Manual Scenarios",
      desc: "Import spreadsheet scripts directly to execute custom test suites without specification URL.",
      borderColor: "border-purple-500/20",
      activeBg: "bg-purple-600/10 border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.12)]",
      accentText: "text-purple-400 font-bold",
      icon: FileCode
    },
    both: {
      label: "Combined Audit",
      desc: "Merge specification-generated test cases with uploaded spreadsheets seamlessly.",
      borderColor: "border-emerald-500/20",
      activeBg: "bg-emerald-600/10 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.12)]",
      accentText: "text-emerald-400 font-bold",
      icon: Sparkles
    },
  };

  return (
    <div className="min-h-screen text-slate-100 font-sans antialiased relative">
      
      {/* Dynamic 2026 header panel */}
      <header className="border-b border-white/[0.04] bg-[#05070c]/50 backdrop-blur-md sticky top-0 z-40">
        <div className="w-full px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Flame className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <span className="font-black text-xs text-white tracking-tight leading-none uppercase">SWAGGER<span className="text-blue-500">PILOT</span></span>
              <span className="ml-2 text-[9px] uppercase font-bold tracking-widest px-2.5 py-1 rounded bg-slate-950/80 text-slate-400 border border-white/[0.04]">API Test Runner</span>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-white/[0.04] shadow">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Engine Ready</span>
          </div>
        </div>
      </header>

      <main className="w-full px-6 py-8 space-y-6 relative z-10">
        
        {/* Modern executive header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-600/10 border border-blue-500/20 text-blue-400 text-[10px] uppercase font-extrabold tracking-wider">
              <Zap className="h-3 w-3" />
              <span>Next-Gen API Auditing</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none">
              Paste your OpenAPI URL. Get a full API audit in minutes.
            </h1>
            <p className="text-slate-400 text-xs font-medium max-w-xl">
              SwaggerPilot generates 100+ tests from your spec, runs them live, and produces a client-ready PDF — plus CI export and Postman replay for your dev team.
            </p>
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

        {/* 🎯 SPEC TARGET COMMAND CENTER - DENSE TOP BAR TO PREVENT SCROLLING */}
        {(mode === "auto" || mode === "both") && (
          <div className="glass-panel rounded-2xl p-5 shadow-xl relative overflow-hidden border border-white/[0.04] glow-card-hover bg-[#05070c]/35">
            <div className="absolute top-0 right-0 w-80 h-32 bg-blue-500/5 blur-3xl rounded-full pointer-events-none" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-4 border-b border-white/[0.04]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex-shrink-0">
                  <Globe className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-white tracking-tight uppercase">
                    1. Target API Specification Intake
                  </h3>
                  <p className="text-[9px] text-slate-500">
                    Provide the OpenAPI/Swagger JSON or YAML specification URL of your endpoint.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2 items-center flex-wrap">
                <span className="text-[9px] uppercase tracking-wider font-bold text-slate-550 mr-1">Load Preset Spec:</span>
                {SAMPLE_URLS.map((s) => (
                  <button
                    key={s.url}
                    onClick={() => loadSample(s)}
                    className="text-[9px] uppercase font-bold tracking-wider bg-slate-900/60 hover:bg-slate-800 text-blue-450 hover:text-blue-300 px-2.5 py-1 rounded-lg transition-all font-mono border border-white/[0.05] shadow"
                  >
                    {s.label.includes("2.0") ? "Swagger 2.0" : "OpenAPI 3.0"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="text-[9px] text-slate-455 font-bold uppercase tracking-wider block mb-1.5">OpenAPI Spec URL Path</label>
                <input
                  type="text"
                  placeholder="Paste spec endpoint (e.g. https://api.yoursite.com/openapi.json)"
                  value={config.swaggerUrl}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, swaggerUrl: e.target.value }))
                  }
                  className="w-full bg-slate-950 border border-white/[0.06] rounded-xl px-4 py-2.5 text-white placeholder-slate-650 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 font-mono text-xs shadow-inner"
                />
              </div>

              <div>
                <label className="text-[9px] text-slate-455 font-bold uppercase tracking-wider block mb-1.5">Target Host Override Path</label>
                <input
                  type="text"
                  placeholder="e.g. http://localhost:3000/v1"
                  value={config.baseUrl}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, baseUrl: e.target.value }))
                  }
                  className="w-full bg-slate-950 border border-white/[0.06] rounded-xl px-4 py-2.5 text-white placeholder-slate-650 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 font-mono text-xs shadow-inner"
                />
              </div>
            </div>

            {isLocalUrl && (
              <div className="mt-3 flex items-start gap-2.5 bg-amber-955/10 border border-amber-900/40 rounded-xl px-4 py-2 text-amber-300 text-[10px] shadow">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-455 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Localhost target detected:</strong> Ensure your server CORS policy permits browser access or that localhost network proxies are allowed.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Spec Target for Manual Mode */}
        {mode === "manual" && (
          <div className="glass-panel rounded-2xl p-5 shadow-xl relative overflow-hidden border border-white/[0.04] glow-card-hover bg-[#05070c]/35">
            <div className="flex items-center gap-2.5 mb-4 pb-4 border-b border-white/[0.04]">
              <div className="p-2 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex-shrink-0">
                <Globe className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-white tracking-tight uppercase">
                  1. Target API Host Override Path
                </h3>
                <p className="text-[9px] text-slate-500">
                  Configure the primary server destination for manual assertion runs.
                </p>
              </div>
            </div>
            <div>
              <label className="text-[9px] text-slate-455 font-bold uppercase tracking-wider block mb-1.5">Target Host URL</label>
              <input
                type="text"
                placeholder="e.g. http://localhost:3003  or  https://staging.api.com"
                value={config.baseUrl}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, baseUrl: e.target.value }))
                }
                className="w-full bg-slate-950 border border-white/[0.06] rounded-xl px-4 py-2.5 text-white placeholder-slate-650 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 font-mono text-xs shadow-inner"
              />
            </div>
          </div>
        )}

        {/* ── 3-COLUMN COCKPIT LAYOUT ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* COLUMN 1: CONFIGURATION MODE */}
          <div className="space-y-6">
            <div className="glass-panel rounded-2xl p-5 shadow-lg space-y-4 glow-card-hover">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 pb-2.5 border-b border-white/[0.04]">
                <Sliders className="h-3.5 w-3.5 text-blue-400" />
                2. Audit Mode Selector
              </h3>
              
              <div className="space-y-3">
                {(["auto", "manual", "both"] as Mode[]).map((m) => {
                  const cfg = modeConfig[m];
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`w-full rounded-xl p-3 text-left border transition-all duration-200 flex gap-3 outline-none ${
                        mode === m
                          ? `${cfg.activeBg}`
                          : "border-transparent bg-slate-950/20 hover:bg-slate-900/20"
                      }`}
                    >
                      <div className={`p-2 rounded h-8 w-8 flex items-center justify-center flex-shrink-0 ${mode === m ? 'bg-slate-950 text-white' : 'bg-slate-900/60 text-slate-500'}`}>
                        <Icon className={`h-4 w-4 ${mode === m ? cfg.accentText : ''}`} />
                      </div>
                      <div>
                        <div className={`text-xs font-bold tracking-tight ${mode === m ? "text-white animate-pulse-short" : "text-slate-350"}`}>
                          {cfg.label}
                        </div>
                        <p className="text-[9px] text-slate-500 mt-1 leading-relaxed">
                          {cfg.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* COLUMN 2: AUTHORIZATION DETAILS */}
          <div className="space-y-6">
            <div className="glass-panel rounded-2xl p-5 shadow-lg space-y-4 h-full glow-card-hover">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-white/[0.04] pb-2.5">
                <Lock className="h-3.5 w-3.5 text-blue-400" />
                3. Security Parameters
              </h3>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { type: "none", label: "No Auth", icon: Shield },
                  { type: "bearer", label: "Bearer Token", icon: Key },
                  { type: "apikey", label: "API Key Header", icon: Lock },
                  { type: "basic", label: "Basic Auth", icon: UserCheck },
                  { type: "autologin", label: "Auto Login", icon: Sparkles }
                ].map(({ type, label, icon: Icon }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setConfig((c) => ({ ...c, authType: type as any }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-semibold border transition-all justify-start outline-none ${
                      config.authType === type
                        ? "bg-blue-600/10 border-blue-500/40 text-blue-400 shadow-md shadow-blue-900/10"
                        : "bg-slate-950/20 border-white/[0.04] text-slate-450 hover:text-slate-300 hover:bg-slate-900/30"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>

              <div className="pt-2 space-y-3.5">
                {config.authType === "bearer" && (
                  <div className="space-y-1.5 animate-fadeIn">
                    <label className="text-[9px] text-slate-455 font-bold uppercase tracking-wider block">JWT Bearer Authorization String</label>
                    <textarea
                      placeholder="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={config.authValue}
                      rows={5}
                      onChange={(e) =>
                        setConfig((c) => ({ ...c, authValue: e.target.value }))
                      }
                      className="w-full bg-slate-950 border border-white/[0.06] rounded-xl px-3 py-2 text-white placeholder-slate-650 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 font-mono text-[10px] resize-none leading-relaxed"
                    />
                  </div>
                )}

                {config.authType === "apikey" && (
                  <div className="space-y-3.5 animate-fadeIn">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] text-slate-455 font-bold uppercase tracking-wider block mb-1">Key Field Header</label>
                        <input
                          type="text"
                          placeholder="X-API-Key"
                          value={config.apiKeyName}
                          onChange={(e) =>
                            setConfig((c) => ({ ...c, apiKeyName: e.target.value }))
                          }
                          className="w-full bg-slate-955 border border-white/[0.06] rounded-xl px-3 py-2 text-white placeholder-slate-650 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 text-[10px] font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-455 font-bold uppercase tracking-wider block mb-1">Transport</label>
                        <select
                          value={config.apiKeyLocation}
                          onChange={(e) =>
                            setConfig((c) => ({
                              ...c,
                              apiKeyLocation: e.target.value as any,
                            }))
                          }
                          className="w-full bg-slate-955 border border-white/[0.06] rounded-xl px-2.5 py-2 text-slate-350 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 text-[10px] font-semibold"
                        >
                          <option value="header">HTTP Header</option>
                          <option value="query">URL Query</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-455 font-bold uppercase tracking-wider block mb-1">Key secret value</label>
                      <input
                        type="text"
                        placeholder="Enter authentication key value"
                        value={config.authValue}
                        onChange={(e) =>
                          setConfig((c) => ({ ...c, authValue: e.target.value }))
                        }
                        className="w-full bg-slate-955 border border-white/[0.06] rounded-xl px-3 py-2 text-white placeholder-slate-650 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 font-mono text-[10px]"
                      />
                    </div>
                  </div>
                )}

                {config.authType === "basic" && (
                  <div className="animate-fadeIn">
                    <label className="text-[9px] text-slate-455 font-bold uppercase tracking-wider block mb-1">Basic Base64 String</label>
                    <input
                      type="text"
                      placeholder="username:password"
                      value={config.authValue}
                      onChange={(e) =>
                        setConfig((c) => ({ ...c, authValue: e.target.value }))
                      }
                      className="w-full bg-slate-955 border border-white/[0.06] rounded-xl px-3 py-2 text-white placeholder-slate-650 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 font-mono text-[10px]"
                    />
                  </div>
                )}

                {config.authType === "autologin" && (
                  <div className="space-y-3.5 animate-fadeIn">
                    <div>
                      <label className="text-[9px] text-slate-455 font-bold uppercase tracking-wider block mb-1">Identity POST Token URL</label>
                      <input
                        type="text"
                        placeholder="https://api.yourapp.com/auth/login"
                        value={config.loginUrl}
                        onChange={(e) =>
                          setConfig((c) => ({ ...c, loginUrl: e.target.value }))
                        }
                        className="w-full bg-slate-955 border border-white/[0.06] rounded-xl px-3 py-2 text-white placeholder-slate-650 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 font-mono text-[10px]"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] text-slate-455 font-bold uppercase tracking-wider block mb-1">Username / Client ID</label>
                        <input
                          type="text"
                          placeholder="Email or identity ID"
                          value={config.loginUsername}
                          onChange={(e) =>
                            setConfig((c) => ({ ...c, loginUsername: e.target.value }))
                          }
                          className="w-full bg-slate-955 border border-white/[0.06] rounded-xl px-3 py-2 text-white placeholder-slate-650 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 text-[10px]"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-455 font-bold uppercase tracking-wider block mb-1">Secret Password</label>
                        <input
                          type="password"
                          placeholder="Password"
                          value={config.loginPassword}
                          onChange={(e) =>
                            setConfig((c) => ({ ...c, loginPassword: e.target.value }))
                          }
                          className="w-full bg-slate-955 border border-white/[0.06] rounded-xl px-3 py-2 text-white placeholder-slate-655 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 text-[10px]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {config.authType === "none" && (
                  <div className="text-center py-10 text-slate-500 font-mono text-[10px] space-y-2 bg-[#05070c]/50 rounded-2xl border border-white/[0.03]">
                    <Shield className="h-6 w-6 text-slate-600 mx-auto animate-pulse" />
                    <p>Auditing target in unprotected mode.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* COLUMN 3: OVERRIDES & SPREADSHEETS ZONE */}
          <div className="space-y-6">
            
            {/* Spreadsheet upload zones */}
            {(mode === "manual" || mode === "both") && (
              <div className="animate-fadeIn">
                <CustomTestUpload
                  onTestsLoaded={(content, type, count) => {
                    setCustomTestsContent(content);
                    setCustomTestsType(type);
                    setCustomTestsCount(count);
                  }}
                  onClear={() => {
                    setCustomTestsContent(null);
                    setCustomTestsCount(0);
                  }}
                  loadedCount={customTestsCount}
                  required={mode === "manual"}
                />
              </div>
            )}

            {/* Fuzz Modifiers */}
            <div className="glass-panel rounded-2xl p-5 shadow-lg space-y-4 glow-card-hover">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-white/[0.04] pb-2.5">
                <Sliders className="h-3.5 w-3.5 text-blue-400" />
                4. Audit Modifiers
              </h3>

              <div className="space-y-4 text-xs">
                {/* Rate limit delay slider */}
                <div className="border-b border-white/[0.04] pb-3.5">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="text-xs font-bold text-slate-350">Rate-Limiting Interval</h4>
                    <span className="text-[10px] font-mono text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{config.delayBetweenTests}ms</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1000}
                    step={10}
                    value={config.delayBetweenTests}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        delayBetweenTests: Number(e.target.value),
                      }))
                    }
                    className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <p className="text-[9px] text-slate-500 mt-1 leading-none">Sets the API request throttle delay between audits.</p>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-300 mb-2">Run profile</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { id: 'smoke' as const, label: 'Smoke', desc: 'Auth + happy path — fast CI' },
                      { id: 'full' as const, label: 'Full audit', desc: 'All rules + AI edge cases' },
                    ]).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          setConfig((c) => ({
                            ...c,
                            runProfile: p.id,
                            skipAiGeneration: p.id === 'smoke' ? true : c.skipAiGeneration,
                          }))
                        }
                        className={`rounded-xl p-2.5 text-left border transition-all outline-none ${
                          config.runProfile === p.id
                            ? 'bg-blue-600/15 border-blue-500/40 shadow-md'
                            : 'bg-slate-950/40 border-white/[0.04] hover:border-white/[0.08]'
                        }`}
                      >
                        <div className={`text-[10px] font-bold ${config.runProfile === p.id ? 'text-blue-300' : 'text-slate-400'}`}>
                          {p.label}
                        </div>
                        <p className="text-[8px] text-slate-500 mt-0.5">{p.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 font-sans">Skip AI Edge-Cases</h4>
                    <p className="text-[9px] text-slate-500 mt-0.5">Disables Gemini (full profile only).</p>
                  </div>
                  <button
                    type="button"
                    disabled={config.runProfile === 'smoke'}
                    onClick={() =>
                      setConfig((c) => ({
                        ...c,
                        skipAiGeneration: !c.skipAiGeneration,
                      }))
                    }
                    className={`w-10 h-5.5 rounded-full transition-all relative flex items-center flex-shrink-0 outline-none custom-switch ${
                      config.skipAiGeneration || config.runProfile === 'smoke' ? "bg-blue-600" : "bg-slate-800"
                    } ${config.runProfile === 'smoke' ? 'opacity-50' : ''}`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full transition-transform absolute ${config.skipAiGeneration || config.runProfile === 'smoke' ? "right-0.5" : "left-0.5"}`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ── INTERACTIVE ACTION TRIGGER WIDGET ── */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-white/[0.04]">
          {mode !== "manual" && (
            <button
              onClick={handleDryRun}
              disabled={isRunning}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-900/60 border border-white/[0.06] hover:border-white/[0.1] hover:bg-slate-800 disabled:opacity-40 text-slate-300 font-bold rounded-xl transition-all text-xs active:scale-[0.98] outline-none shadow-md"
            >
              <Eye className="h-4 w-4" />
              <span>Dry Run Spec</span>
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={isRunning || !canRun()}
            className="flex-1 flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-blue-600 via-indigo-650 to-purple-650 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all text-sm shadow-xl shadow-blue-500/10 active:scale-[0.99] outline-none relative overflow-hidden group"
          >
            <Play className="h-4 w-4 fill-white flex-shrink-0" />
            <span className="relative z-10 font-bold tracking-wide uppercase text-xs">
              {isRunning
                ? "Launching Auditing Suite..."
                : mode === "manual"
                  ? `Execute Custom Suite (${customTestsCount} manual cases)`
                  : mode === "both"
                    ? `Execute Combined Audit (Auto + ${customTestsCount} manual)`
                    : "Execute Automated Fuzzing Suite"}
            </span>
            <div className="absolute inset-0 w-1/2 h-full bg-white/10 skew-x-12 translate-x-[-100%] group-hover:translate-x-[250%] transition-transform duration-1000 ease-out" />
          </button>
        </div>

        {/* Dry run result overlay card */}
        {dryRunResult && (
          <div className="glass-panel rounded-2xl p-5 shadow-xl space-y-4 max-w-4xl border border-white/[0.06] glow-card-hover animate-fadeIn">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 font-mono">
              <Eye className="h-4 w-4 text-blue-400" />
              Dry Run Evaluation Results
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-center">
              <div className="bg-[#05070c]/50 p-3 rounded-xl border border-white/[0.03]">
                <div className="text-xl font-black font-mono text-blue-400 leading-none">{dryRunResult.endpointCount}</div>
                <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider mt-2.5">Endpoints Detected</div>
              </div>
              <div className="bg-[#05070c]/50 p-3 rounded-xl border border-white/[0.03]">
                <div className="text-xl font-black font-mono text-purple-400 leading-none">{dryRunResult.totalTests}</div>
                <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider mt-2.5">Test Scenarios Generated</div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
