import React, { useState } from 'react';
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
  Legend,
} from 'recharts';
import { TestReport, METHOD_COLORS, CATEGORY_LABELS } from '../types';
import TestCard from '../components/TestCard';

interface ReportProps {
  report: TestReport;
  onReset: () => void;
}

export default function Report({ report, onReset }: ReportProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'failures' | 'all'>('summary');

  const pieData = [
    { name: 'Passed', value: report.passed, color: '#22c55e' },
    { name: 'Failed', value: report.failed, color: '#ef4444' },
    { name: 'Errors', value: report.errors, color: '#f97316' },
    { name: 'Skipped', value: report.skipped, color: '#64748b' },
  ].filter((d) => d.value > 0);

  const endpointData = report.byEndpoint.slice(0, 10).map((e) => ({
    name: `${e.method} ${e.endpoint}`.substring(0, 25),
    Passed: e.passed,
    Failed: e.failed + e.errors,
  }));

  const categoryData = report.byCategory.map((c) => ({
    name: CATEGORY_LABELS[c.category] || c.category,
    Passed: c.passed,
    Failed: c.failed,
  }));

  const durationSec = (report.durationMs / 1000).toFixed(1);

  const downloadReport = () => {
    const json = JSON.stringify(report, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swagger-pilot-report-${Date.now()}.json`;
    a.click();
  };

  const downloadHtml = () => {
    const html = generateHtmlReport(report);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swagger-pilot-report-${Date.now()}.html`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✈️</span>
            <div>
              <h1 className="text-xl font-bold text-white">SwaggerPilot — Results</h1>
              <p className="text-slate-400 text-sm">{report.title} • {report.baseUrl}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={downloadReport} className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg transition-colors">
              ⬇️ JSON
            </button>
            <button onClick={downloadHtml} className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg transition-colors">
              ⬇️ HTML
            </button>
            <button onClick={onReset} className="text-sm bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition-colors">
              🔄 New Test
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Token expiry warning */}
        {report.tokenExpiryWarning && (
          <div className="bg-yellow-900/40 border border-yellow-600 rounded-xl p-4 mb-6 text-yellow-300">
            ⚠️ <strong>Possible token expiry detected.</strong> Some 401 failures during the run may be caused by an expired auth token, not actual API failures. Consider using a fresh token.
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Total Tests', value: report.totalTests, color: 'text-blue-400' },
            { label: '✅ Passed', value: report.passed, color: 'text-green-400' },
            { label: '❌ Failed', value: report.failed, color: 'text-red-400' },
            { label: '⚠️ Errors', value: report.errors, color: 'text-orange-400' },
            { label: 'Pass Rate', value: `${report.passRate}%`, color: report.passRate >= 70 ? 'text-green-400' : 'text-red-400' },
          ].map((card) => (
            <div key={card.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
              <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
              <div className="text-xs text-slate-400 mt-1">{card.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          {/* Pie Chart */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <h3 className="font-medium mb-4">Overall Results</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Category Bar Chart */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <h3 className="font-medium mb-4">Results by Category</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={categoryData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                <Legend />
                <Bar dataKey="Passed" fill="#22c55e" />
                <Bar dataKey="Failed" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Endpoint Breakdown */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-6">
          <h3 className="font-medium mb-4">📊 Results by Endpoint</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={endpointData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} width={120} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                <Legend />
                <Bar dataKey="Passed" fill="#22c55e" stackId="a" />
                <Bar dataKey="Failed" fill="#ef4444" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tabs: Summary / Failures / All */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl">
          <div className="flex border-b border-slate-700">
            {([
              ['summary', 'Endpoint Summary'],
              ['failures', `Failures & Errors (${report.failed + report.errors})`],
              ['all', `All Tests (${report.totalTests})`],
            ] as const).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {activeTab === 'summary' && (
              <div className="space-y-2">
                {report.byEndpoint.map((ep, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-700/50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${METHOD_COLORS[ep.method] || 'bg-gray-500'} text-white`}>
                        {ep.method}
                      </span>
                      <span className="font-mono text-sm text-slate-300">{ep.endpoint}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-green-400">{ep.passed}✅</span>
                      {ep.failed > 0 && <span className="text-red-400">{ep.failed}❌</span>}
                      {ep.errors > 0 && <span className="text-orange-400">{ep.errors}⚠️</span>}
                      {ep.skipped > 0 && <span className="text-slate-500">{ep.skipped}⏭️</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'failures' && (
              <div>
                {report.failedTests.length === 0 ? (
                  <div className="text-center py-8 text-green-400">
                    <div className="text-3xl mb-2">🎉</div>
                    <p>No failures! All tests passed.</p>
                  </div>
                ) : (
                  report.failedTests.map((r, i) => <TestCard key={i} result={r} />)
                )}
              </div>
            )}

            {activeTab === 'all' && (
              <div className="max-h-96 overflow-y-auto scrollbar-thin">
                {report.allTests.map((r, i) => <TestCard key={i} result={r} />)}
              </div>
            )}
          </div>
        </div>

        {/* Meta info */}
        <div className="mt-4 text-xs text-slate-500 flex gap-4 flex-wrap">
          <span>Started: {new Date(report.startedAt).toLocaleString()}</span>
          <span>Duration: {durationSec}s</span>
          <span>Skipped: {report.skipped}</span>
          <span>AI-generated tests: {report.allTests.filter((t) => t.isAiGenerated).length}</span>
        </div>
      </div>
    </div>
  );
}

function generateHtmlReport(report: TestReport): string {
  return `<!DOCTYPE html>
<html><head><title>SwaggerPilot Report — ${report.title}</title>
<style>
  body { font-family: sans-serif; background: #0f172a; color: #e2e8f0; padding: 20px; }
  h1 { color: #60a5fa; } table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { border: 1px solid #334155; padding: 8px 12px; text-align: left; font-size: 13px; }
  th { background: #1e293b; } .pass { color: #22c55e; } .fail { color: #ef4444; }
  .error { color: #f97316; } .skip { color: #64748b; }
  .summary { display: flex; gap: 16px; flex-wrap: wrap; margin: 16px 0; }
  .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 20px; text-align: center; }
  .card .val { font-size: 24px; font-weight: bold; } .card .lbl { font-size: 12px; color: #94a3b8; }
</style></head><body>
<h1>✈️ SwaggerPilot Report — ${report.title}</h1>
<p>URL: ${report.swaggerUrl} | Base: ${report.baseUrl} | ${new Date(report.startedAt).toLocaleString()}</p>
<div class="summary">
  <div class="card"><div class="val">${report.totalTests}</div><div class="lbl">Total</div></div>
  <div class="card"><div class="val pass">${report.passed}</div><div class="lbl">Passed</div></div>
  <div class="card"><div class="val fail">${report.failed}</div><div class="lbl">Failed</div></div>
  <div class="card"><div class="val error">${report.errors}</div><div class="lbl">Errors</div></div>
  <div class="card"><div class="val">${report.passRate}%</div><div class="lbl">Pass Rate</div></div>
</div>
<h2>Failed Tests</h2>
<table><tr><th>Test</th><th>Method</th><th>Path</th><th>Expected</th><th>Got</th><th>Error</th></tr>
${report.failedTests.map((t) => `<tr>
  <td>${t.testName}</td><td>${t.method}</td><td>${t.path}</td>
  <td>${t.expected.join(' or ')}</td>
  <td class="fail">${t.actual ?? 'N/A'}</td>
  <td>${t.errorMessage || ''}</td>
</tr>`).join('')}
</table>
<h2>All Tests</h2>
<table><tr><th>Status</th><th>Test</th><th>Method</th><th>Category</th><th>Expected</th><th>Got</th><th>Time</th></tr>
${report.allTests.map((t) => `<tr>
  <td class="${t.status.toLowerCase()}">${t.status}</td>
  <td>${t.testName}</td><td>${t.method}</td>
  <td>${t.category}</td><td>${t.expected.join(' or ')}</td>
  <td>${t.actual ?? 'N/A'}</td><td>${t.responseTime}ms</td>
</tr>`).join('')}
</table>
</body></html>`;
}
