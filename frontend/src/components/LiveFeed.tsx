import React, { useEffect, useRef, useState, useMemo } from 'react';
import { TestResult } from '../types';
import { 
  Square, 
  Terminal as TerminalIcon, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Lock,
  Unlock,
  Search,
  Sliders,
  Play
} from "lucide-react";

interface LiveFeedProps {
  results: TestResult[];
  phase: string;
  statusMessage: string;
  totalTests: number;
  completedTests: number;
  warnings: string[];
  onCancel: () => void;
  isRunning: boolean;
}

export default function LiveFeed({
  results,
  phase,
  statusMessage,
  totalTests,
  completedTests,
  warnings,
  onCancel,
  isRunning,
}: LiveFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<'all' | 'PASS' | 'FAIL' | 'ERROR' | 'SKIPPED'>('all');
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [results, autoScroll]);

  const progressPercent = totalTests > 0 ? Math.round((completedTests / totalTests) * 100) : 0;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const errors = results.filter((r) => r.status === 'ERROR').length;

  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      const matchesFilter = filter === 'all' || r.status === filter;
      const matchesSearch = 
        r.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.testName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [results, filter, searchQuery]);

  const statusConfig = {
    PASS: { dot: "bg-emerald-500", text: "text-emerald-400 font-bold", tag: "[PASS]", badge: "badge-neon-emerald" },
    FAIL: { dot: "bg-rose-500", text: "text-rose-500 font-bold", tag: "[FAIL]", badge: "badge-neon-rose" },
    ERROR: { dot: "bg-amber-500", text: "text-amber-500 font-bold", tag: "[ERR ]", badge: "badge-neon-rose animate-pulse" },
    SKIPPED: { dot: "bg-slate-500", text: "text-slate-500", tag: "[SKIP]", badge: "bg-slate-900 border-slate-700 text-slate-500" }
  };

  const getMethodColor = (m: string) => {
    const map: Record<string, string> = {
      GET: "text-blue-400 font-bold",
      POST: "text-emerald-450 font-bold",
      PUT: "text-amber-400 font-bold",
      DELETE: "text-rose-500 font-bold",
      PATCH: "text-orange-400 font-bold"
    };
    return map[m] || "text-slate-400";
  };

  return (
    <div className="flex flex-col h-full text-slate-100 font-sans">
      
      {/* High-density status cockpit panel */}
      <div className="glass-panel rounded-2xl p-4.5 mb-4 shadow-lg border-white/[0.04] bg-[#05070c]/35">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping"></span>
            <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase font-mono">{phase} Phase Active</span>
            <span className="text-xs text-slate-650">•</span>
            <span className="text-xs text-slate-205 font-bold tracking-tight">{statusMessage}</span>
          </div>
          {isRunning && (
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 text-[10px] bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-1.5 rounded-lg font-extrabold uppercase tracking-wider transition-all active:scale-[0.98] shadow-lg shadow-rose-950/20 border border-rose-650/30"
            >
              <Square className="h-3 w-3 fill-white" />
              <span>Abort Run</span>
            </button>
          )}
        </div>

        {/* Progress gauge bar */}
        {totalTests > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1.5">
              <span>{completedTests} / {totalTests} API Audits Executed</span>
              <span className="text-blue-450 font-bold tracking-wider">{progressPercent}% Completed</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-white/[0.04] shadow-inner">
              <div
                className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 h-full rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Live counters widgets */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-[#05070c]/55 border border-white/[0.04] rounded-xl p-2.5 flex items-center justify-center gap-3 shadow-sm">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <div className="text-left leading-none">
              <div className="text-base font-black text-white font-mono leading-none tracking-tight">{passed}</div>
              <span className="text-[8px] uppercase font-bold text-slate-500 tracking-widest block mt-1">PASSED</span>
            </div>
          </div>
          <div className="bg-[#05070c]/55 border border-white/[0.04] rounded-xl p-2.5 flex items-center justify-center gap-3 shadow-sm">
            <XCircle className="h-5 w-5 text-rose-500" />
            <div className="text-left leading-none">
              <div className="text-base font-black text-white font-mono leading-none tracking-tight">{failed}</div>
              <span className="text-[8px] uppercase font-bold text-slate-500 tracking-widest block mt-1">FAILED</span>
            </div>
          </div>
          <div className="bg-[#05070c]/55 border border-white/[0.04] rounded-xl p-2.5 flex items-center justify-center gap-3 shadow-sm">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <div className="text-left leading-none">
              <div className="text-base font-black text-white font-mono leading-none tracking-tight">{errors}</div>
              <span className="text-[8px] uppercase font-bold text-slate-500 tracking-widest block mt-1">ERRORS</span>
            </div>
          </div>
        </div>
      </div>

      {/* Warnings alerts */}
      {warnings.length > 0 && (
        <div className="space-y-1.5 mb-3.5 animate-fadeIn">
          {warnings.map((w, i) => (
            <div key={i} className="flex gap-2.5 bg-amber-955/10 border border-amber-900/40 rounded-xl px-3.5 py-2 text-amber-300 text-xs shadow">
              <AlertTriangle className="h-4 w-4 text-amber-455 flex-shrink-0 mt-0.5" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar filters bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3.5">
        
        {/* Console Search */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search console stream..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#05070c]/50 border border-white/[0.06] rounded-xl pl-8 pr-3 py-1.5 text-white placeholder-slate-650 focus:outline-none focus:border-blue-500/50 font-mono text-[10px]"
          />
        </div>

        {/* Action controls */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1.5">
            {(['all', 'PASS', 'FAIL', 'ERROR', 'SKIPPED'] as const).map((f) => {
              const count = f === 'all' ? results.length : results.filter((r) => r.status === f).length;
              let btnClass = "bg-[#05070c]/50 hover:bg-slate-900/40 text-slate-500 border border-white/[0.04] hover:text-slate-350";
              if (filter === f) {
                if (f === 'all') btnClass = "bg-blue-600/10 border-blue-500/40 text-blue-400 font-bold shadow-md shadow-blue-900/10";
                else if (f === 'PASS') btnClass = "bg-emerald-600/10 border-emerald-500/40 text-emerald-450 font-bold shadow-md shadow-emerald-900/10";
                else if (f === 'FAIL') btnClass = "bg-rose-600/10 border-rose-500/40 text-rose-500 font-bold shadow-md shadow-rose-900/10";
                else if (f === 'ERROR') btnClass = "bg-amber-600/10 border-amber-500/40 text-amber-450 font-bold shadow-md shadow-amber-900/10";
                else btnClass = "bg-slate-800 border-slate-700 text-slate-200 font-bold";
              }
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-[9px] uppercase font-bold tracking-widest px-2.5 py-1.5 rounded-lg transition-all outline-none border select-none ${btnClass}`}
                >
                  {f === 'all' ? `All logs (${count})` : `${f} (${count})`}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center gap-1.5 text-[9px] uppercase font-bold tracking-wider px-2.5 py-1.5 rounded-lg transition-all border outline-none select-none ${
              autoScroll 
                ? 'bg-blue-600/10 border-blue-500/40 text-blue-400 shadow-md' 
                : 'bg-[#05070c]/50 border border-white/[0.04] text-slate-400 hover:text-slate-300'
            }`}
          >
            {autoScroll ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            <span>Auto-Scroll {autoScroll ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Terminal active grid view scanline */}
      <div className="flex-1 min-h-[400px] bg-[#05070c]/60 border border-white/[0.05] rounded-2xl overflow-hidden flex flex-col shadow-inner backdrop-blur-md scanlines">
        {/* Terminal Header */}
        <div className="bg-[#05070c]/90 border-b border-white/[0.04] px-4 py-2.5 flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <TerminalIcon className="h-4 w-4 text-slate-500 animate-pulse" />
            <span className="text-[9px] font-mono uppercase font-bold tracking-widest text-slate-450">Console Output feed</span>
          </div>
          <span className="text-[9px] font-mono text-slate-550 uppercase font-bold tracking-wider">UTF-8 • socket_node:active</span>
        </div>

        {/* Live list scrolling */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 scrollbar-thin font-mono text-[10px] leading-normal bg-[#030509]/80 z-20 relative">
          {filteredResults.length === 0 && results.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center text-slate-650 font-mono select-none">
              <TerminalIcon className="h-8 w-8 text-slate-800 mb-3 animate-pulse" />
              <p className="text-xs font-bold">Initializing audit console stream...</p>
              <p className="text-[9px] text-slate-700 mt-1">Awaiting real-time audit triggers from active spec plans</p>
            </div>
          )}
          
          {filteredResults.map((t, i) => {
            const cfg = statusConfig[t.status];
            const time = new Date().toLocaleTimeString();
            return (
              <div 
                key={i} 
                className="flex items-start gap-2 py-1 px-1.5 rounded hover:bg-white/[0.02] transition-colors tracking-tight font-medium"
              >
                <span className="text-slate-650 flex-shrink-0 select-none">[{time}]</span>
                <span className={`flex-shrink-0 select-none text-[8.5px] uppercase font-bold tracking-wider ${cfg.text}`}>{cfg.tag}</span>
                <span className={`w-10 flex-shrink-0 font-bold select-none ${getMethodColor(t.method)}`}>{t.method.padEnd(4)}</span>
                <span className="text-slate-300 break-all select-all">{t.path}</span>
                <span className="text-slate-650 flex-shrink-0 select-none">—</span>
                <span className="text-slate-450 truncate flex-1">{t.testName.replace(`${t.method} ${t.path} — `, "")}</span>
                <span className="text-slate-605 flex-shrink-0 select-none font-bold">({t.responseTime}ms)</span>
                {t.actual && (
                  <span className={`flex-shrink-0 font-bold tracking-wider ${t.actual < 400 ? 'text-emerald-450' : 'text-rose-500 text-shadow-red'}`}>
                    HTTP:{t.actual}
                  </span>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
