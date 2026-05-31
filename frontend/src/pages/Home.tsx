import React, { useState } from 'react';
import { RunTestsConfig } from '../types';

interface HomeProps {
  onRunTests: (config: RunTestsConfig) => void;
  onDryRun: (config: RunTestsConfig) => void;
  dryRunResult: any;
  isRunning: boolean;
}

const SAMPLE_URLS = [
  { label: 'Petstore (Swagger 2.0)', url: 'https://petstore.swagger.io/v2/swagger.json', base: 'https://petstore.swagger.io/v2' },
  { label: 'Petstore (OpenAPI 3.0)', url: 'https://petstore3.swagger.io/api/v3/openapi.json', base: 'https://petstore3.swagger.io/api/v3' },
];

export default function Home({ onRunTests, onDryRun, dryRunResult, isRunning }: HomeProps) {
  const [config, setConfig] = useState<RunTestsConfig>({
    swaggerUrl: '',
    baseUrl: '',
    authType: 'none',
    authValue: '',
    apiKeyName: 'X-API-Key',
    apiKeyLocation: 'header',
    loginUrl: '',
    loginUsername: '',
    loginPassword: '',
    delayBetweenTests: 150,
    skipAiGeneration: false,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isLocalUrl = config.swaggerUrl.includes('localhost') || config.swaggerUrl.includes('127.0.0.1');

  const handleSubmit = () => {
    if (!config.swaggerUrl.trim()) {
      alert('Please enter a Swagger URL');
      return;
    }
    onRunTests(config);
  };

  const handleDryRun = () => {
    if (!config.swaggerUrl.trim()) {
      alert('Please enter a Swagger URL');
      return;
    }
    onDryRun(config);
  };

  const loadSample = (sample: typeof SAMPLE_URLS[0]) => {
    setConfig((c) => ({ ...c, swaggerUrl: sample.url, baseUrl: sample.base }));
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="text-3xl">✈️</div>
          <div>
            <h1 className="text-2xl font-bold text-white">SwaggerPilot</h1>
            <p className="text-slate-400 text-sm">AI-Powered Automatic API Test Runner</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Main Form Card */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>🔗</span> Swagger / OpenAPI URL
          </h2>

          {/* Sample URLs */}
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
            onChange={(e) => setConfig((c) => ({ ...c, swaggerUrl: e.target.value }))}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono text-sm"
          />

          {/* Localhost warning */}
          {isLocalUrl && (
            <div className="mt-2 bg-yellow-900/40 border border-yellow-700 rounded-lg px-3 py-2 text-yellow-300 text-sm">
              ⚠️ <strong>Local URL detected.</strong> Make sure the SwaggerPilot backend is running on the <strong>same machine</strong> as your API. Use <code className="bg-yellow-900/60 px-1 rounded">host.docker.internal</code> instead of <code className="bg-yellow-900/60 px-1 rounded">localhost</code> if using Docker.
            </div>
          )}

          <div className="mt-3">
            <label className="text-sm text-slate-400 mb-1 block">
              Base URL Override <span className="text-slate-500">(optional — if API runs on different host than swagger)</span>
            </label>
            <input
              type="text"
              placeholder="https://api.yourapp.com/v1"
              value={config.baseUrl}
              onChange={(e) => setConfig((c) => ({ ...c, baseUrl: e.target.value }))}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
          </div>
        </div>

        {/* Auth Card */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>🔐</span> Authentication
          </h2>

          <div className="grid grid-cols-2 gap-2 mb-4 sm:grid-cols-5">
            {(['none', 'bearer', 'apikey', 'basic', 'autologin'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setConfig((c) => ({ ...c, authType: type }))}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  config.authType === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {type === 'none' && 'None'}
                {type === 'bearer' && 'Bearer'}
                {type === 'apikey' && 'API Key'}
                {type === 'basic' && 'Basic'}
                {type === 'autologin' && 'Auto Login'}
              </button>
            ))}
          </div>

          {config.authType === 'bearer' && (
            <input
              type="text"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={config.authValue}
              onChange={(e) => setConfig((c) => ({ ...c, authValue: e.target.value }))}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
          )}

          {config.authType === 'apikey' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Header name (e.g. X-API-Key)"
                  value={config.apiKeyName}
                  onChange={(e) => setConfig((c) => ({ ...c, apiKeyName: e.target.value }))}
                  className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 text-sm"
                />
                <select
                  value={config.apiKeyLocation}
                  onChange={(e) => setConfig((c) => ({ ...c, apiKeyLocation: e.target.value as any }))}
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
                onChange={(e) => setConfig((c) => ({ ...c, authValue: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono text-sm"
              />
            </div>
          )}

          {config.authType === 'basic' && (
            <input
              type="text"
              placeholder="username:password"
              value={config.authValue}
              onChange={(e) => setConfig((c) => ({ ...c, authValue: e.target.value }))}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
          )}

          {config.authType === 'autologin' && (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Login URL (e.g. https://api.yourapp.com/auth/login)"
                value={config.loginUrl}
                onChange={(e) => setConfig((c) => ({ ...c, loginUrl: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Username or email"
                  value={config.loginUsername}
                  onChange={(e) => setConfig((c) => ({ ...c, loginUsername: e.target.value }))}
                  className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 text-sm"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={config.loginPassword}
                  onChange={(e) => setConfig((c) => ({ ...c, loginPassword: e.target.value }))}
                  className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Advanced Settings */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-6">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-2 transition-colors"
          >
            {showAdvanced ? '▼' : '▶'} Advanced Settings
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-300">Delay between tests (ms)</label>
                <input
                  type="number"
                  min={0}
                  max={5000}
                  value={config.delayBetweenTests}
                  onChange={(e) => setConfig((c) => ({ ...c, delayBetweenTests: Number(e.target.value) }))}
                  className="w-24 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-sm text-right"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm text-slate-300">Skip AI test generation</label>
                  <p className="text-xs text-slate-500">Disables Gemini AI bonus tests (requires API key anyway)</p>
                </div>
                <button
                  onClick={() => setConfig((c) => ({ ...c, skipAiGeneration: !c.skipAiGeneration }))}
                  className={`w-12 h-6 rounded-full transition-colors ${config.skipAiGeneration ? 'bg-blue-600' : 'bg-slate-600'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full mx-auto transition-transform ${config.skipAiGeneration ? 'translate-x-2.5' : '-translate-x-2.5'}`} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Dry Run Result */}
        {dryRunResult && (
          <div className="bg-slate-800 rounded-xl border border-blue-700 p-4 mb-6">
            <h3 className="font-medium text-blue-400 mb-2">📊 Dry Run Preview</h3>
            <p className="text-sm text-slate-300">
              <strong>{dryRunResult.totalTests}</strong> tests would run across <strong>{dryRunResult.endpointCount}</strong> endpoints for <strong>{dryRunResult.title}</strong>
            </p>
            <div className="mt-2 max-h-32 overflow-y-auto text-xs space-y-1">
              {dryRunResult.breakdown?.map((b: any, i: number) => (
                <div key={i} className={`flex justify-between px-2 py-1 rounded ${b.skipped ? 'text-slate-500' : 'text-slate-300'}`}>
                  <span className="font-mono">{b.endpoint}</span>
                  <span>{b.skipped ? `⏭️ ${b.skipReason}` : `${b.testCount} tests`}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleDryRun}
            disabled={isRunning}
            className="px-5 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded-xl font-medium transition-colors text-sm"
          >
            👁️ Dry Run
          </button>
          <button
            onClick={handleSubmit}
            disabled={isRunning || !config.swaggerUrl.trim()}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors text-lg"
          >
            {isRunning ? '⏳ Running...' : '🚀 Run Tests'}
          </button>
        </div>

        {/* How it works */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: '🔗', title: 'Paste URL', desc: 'Any Swagger/OpenAPI URL from any framework' },
            { icon: '⚙️', title: 'Auto Generate', desc: '100+ tests generated by rules + AI automatically' },
            { icon: '📊', title: 'See Results', desc: 'Live streaming results with full report' },
          ].map((item) => (
            <div key={item.title} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
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
