import React, { useState } from "react";
import { RunTestsConfig } from "../types";
import CustomTestUpload from "../components/CustomTestUpload";

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

  // Validation per mode
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
      // In manual mode, swagger URL not needed
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

  const modeConfig = {
    auto: {
      label: "⚙️ Auto Only",
      desc: "SwaggerPilot reads your Swagger URL and auto-generates all tests",
      color: "bg-blue-600",
    },
    manual: {
      label: "📋 Manual Only",
      desc: "Upload your own CSV/Excel test file — no Swagger URL needed",
      color: "bg-purple-600",
    },
    both: {
      label: "🚀 Both",
      desc: "Auto-generated tests + your uploaded manual tests together",
      color: "bg-green-600",
    },
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="text-3xl">✈️</div>
          <div>
            <h1 className="text-2xl font-bold text-white">SwaggerPilot</h1>
            <p className="text-slate-400 text-sm">
              AI-Powered Automatic API Test Runner
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* ── MODE SELECTOR ── */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Select Mode
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {(["auto", "manual", "both"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-xl p-4 text-left border-2 transition-all ${
                  mode === m
                    ? `border-blue-500 ${modeConfig[m].color}/20 bg-opacity-20`
                    : "border-slate-600 hover:border-slate-500 bg-slate-700/30"
                }`}
              >
                <div
                  className={`text-sm font-bold mb-1 ${mode === m ? "text-white" : "text-slate-300"}`}
                >
                  {modeConfig[m].label}
                </div>
                <div className="text-xs text-slate-400 leading-relaxed">
                  {modeConfig[m].desc}
                </div>
                {mode === m && (
                  <div
                    className={`mt-2 text-xs px-2 py-0.5 rounded-full inline-block text-white ${modeConfig[m].color}`}
                  >
                    Selected ✓
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── SWAGGER URL (hidden in manual mode) ── */}
        {(mode === "auto" || mode === "both") && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span>🔗</span> Swagger / OpenAPI URL
            </h2>

            <div className="flex gap-2 mb-3 flex-wrap">
              <span className="text-xs text-slate-400 self-center">Try:</span>
              {SAMPLE_URLS.map((s) => (
                <button
                  key={s.url}
                  onClick={() => loadSample(s)}
                  className="text-xs bg-slate-700 hover:bg-slate-600 text-blue-400 px-2 py-1 rounded transition-colors"
                >
                  {s.label}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="https://yourapi.com/api-docs or http://localhost:3000/api-json"
              value={config.swaggerUrl}
              onChange={(e) =>
                setConfig((c) => ({ ...c, swaggerUrl: e.target.value }))
              }
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono text-sm"
            />

            {isLocalUrl && (
              <div className="mt-2 bg-yellow-900/40 border border-yellow-700 rounded-lg px-3 py-2 text-yellow-300 text-sm">
                ⚠️ <strong>Local URL detected.</strong> Make sure SwaggerPilot
                backend is running on the same machine as your API.
              </div>
            )}

            <div className="mt-3">
              <label className="text-sm text-slate-400 mb-1 block">
                Base URL Override{" "}
                <span className="text-slate-500">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="https://api.yourapp.com/v1"
                value={config.baseUrl}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, baseUrl: e.target.value }))
                }
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono text-sm"
              />
            </div>
          </div>
        )}

        {/* ── BASE URL (only in manual mode) ── */}
        {mode === "manual" && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span>🔗</span> Base URL
              <span className="text-red-400 text-sm">*required</span>
            </h2>
            <input
              type="text"
              placeholder="http://localhost:3003  or  https://yourapi.com"
              value={config.baseUrl}
              onChange={(e) =>
                setConfig((c) => ({ ...c, baseUrl: e.target.value }))
              }
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
            <p className="text-xs text-slate-500 mt-2">
              This is where your API is running. All paths from your test file
              will be appended to this URL.
            </p>
          </div>
        )}

        {/* ── AUTH ── */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>🔐</span> Authentication
          </h2>

          <div className="grid grid-cols-2 gap-2 mb-4 sm:grid-cols-5">
            {(["none", "bearer", "apikey", "basic", "autologin"] as const).map(
              (type) => (
                <button
                  key={type}
                  onClick={() => setConfig((c) => ({ ...c, authType: type }))}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    config.authType === type
                      ? "bg-blue-600 text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  {type === "none" && "None"}
                  {type === "bearer" && "Bearer"}
                  {type === "apikey" && "API Key"}
                  {type === "basic" && "Basic"}
                  {type === "autologin" && "Auto Login"}
                </button>
              ),
            )}
          </div>

          {config.authType === "bearer" && (
            <input
              type="text"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={config.authValue}
              onChange={(e) =>
                setConfig((c) => ({ ...c, authValue: e.target.value }))
              }
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
          )}

          {config.authType === "apikey" && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Header name (e.g. X-API-Key)"
                  value={config.apiKeyName}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, apiKeyName: e.target.value }))
                  }
                  className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 text-sm"
                />
                <select
                  value={config.apiKeyLocation}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      apiKeyLocation: e.target.value as any,
                    }))
                  }
                  className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
                >
                  <option value="header">In Header</option>
                  <option value="query">In Query Param</option>
                </select>
              </div>
              <input
                type="text"
                placeholder="Your API key value"
                value={config.authValue}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, authValue: e.target.value }))
                }
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono text-sm"
              />
            </div>
          )}

          {config.authType === "basic" && (
            <input
              type="text"
              placeholder="username:password"
              value={config.authValue}
              onChange={(e) =>
                setConfig((c) => ({ ...c, authValue: e.target.value }))
              }
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
          )}

          {config.authType === "autologin" && (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Login URL (e.g. https://api.yourapp.com/auth/login)"
                value={config.loginUrl}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, loginUrl: e.target.value }))
                }
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Username or email"
                  value={config.loginUsername}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, loginUsername: e.target.value }))
                  }
                  className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 text-sm"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={config.loginPassword}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, loginPassword: e.target.value }))
                  }
                  className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── FILE UPLOAD (shown in manual + both mode) ── */}
        {(mode === "manual" || mode === "both") && (
          <div className="mb-6">
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

        {/* ── ADVANCED ── */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-6">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-2 transition-colors"
          >
            {showAdvanced ? "▼" : "▶"} Advanced Settings
          </button>
          {showAdvanced && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-300">
                  Delay between tests (ms)
                </label>
                <input
                  type="number"
                  min={0}
                  max={5000}
                  value={config.delayBetweenTests}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      delayBetweenTests: Number(e.target.value),
                    }))
                  }
                  className="w-24 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-sm text-right"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm text-slate-300">
                    Skip AI test generation
                  </label>
                  <p className="text-xs text-slate-500">
                    Disables Gemini AI bonus tests
                  </p>
                </div>
                <button
                  onClick={() =>
                    setConfig((c) => ({
                      ...c,
                      skipAiGeneration: !c.skipAiGeneration,
                    }))
                  }
                  className={`w-12 h-6 rounded-full transition-colors ${config.skipAiGeneration ? "bg-blue-600" : "bg-slate-600"}`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full mx-auto transition-transform ${config.skipAiGeneration ? "translate-x-2.5" : "-translate-x-2.5"}`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── BUTTONS ── */}
        <div className="flex gap-3">
          {mode !== "manual" && (
            <button
              onClick={handleDryRun}
              disabled={isRunning}
              className="px-5 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded-xl font-medium transition-colors text-sm"
            >
              👁️ Dry Run
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={isRunning || !canRun()}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors text-lg"
          >
            {isRunning
              ? "⏳ Running..."
              : mode === "manual"
                ? `🚀 Run ${customTestsCount > 0 ? customTestsCount : ""} Manual Tests`
                : mode === "both"
                  ? `🚀 Run Auto + ${customTestsCount} Manual Tests`
                  : "🚀 Run Tests"}
          </button>
        </div>

        {/* ── HOW IT WORKS ── */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: "⚙️",
              title: "Auto Mode",
              desc: "Paste Swagger URL → 100+ tests auto generated",
            },
            {
              icon: "📋",
              title: "Manual Mode",
              desc: "Upload CSV/Excel → run your own test cases",
            },
            {
              icon: "🚀",
              title: "Both Mode",
              desc: "Auto + manual together in one report",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center"
            >
              <div className="text-2xl mb-2">{item.icon}</div>
              <div className="font-medium text-sm">{item.title}</div>
              <div className="text-xs text-slate-400 mt-1">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
