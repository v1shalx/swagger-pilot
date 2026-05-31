import React, { useEffect, useRef, useState } from 'react';
import { TestResult } from '../types';
import TestCard from './TestCard';

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

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [results, autoScroll]);

  const progressPercent = totalTests > 0 ? Math.round((completedTests / totalTests) * 100) : 0;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const errors = results.filter((r) => r.status === 'ERROR').length;

  const filteredResults = filter === 'all' ? results : results.filter((r) => r.status === filter);

  return (
    <div className="flex flex-col h-full">
      {/* Status bar */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">{statusMessage}</span>
          {isRunning && (
            <button
              onClick={onCancel}
              className="text-xs bg-red-800 hover:bg-red-700 text-red-200 px-3 py-1 rounded transition-colors"
            >
              ⏹ Cancel
            </button>
          )}
        </div>

        {/* Progress bar */}
        {totalTests > 0 && (
          <div className="mb-2">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>{completedTests} / {totalTests} tests</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Live stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-green-900/30 border border-green-700/40 rounded-lg py-1">
            <div className="text-green-400 text-lg font-bold">{passed}</div>
            <div className="text-xs text-slate-400">Passed</div>
          </div>
          <div className="bg-red-900/30 border border-red-700/40 rounded-lg py-1">
            <div className="text-red-400 text-lg font-bold">{failed}</div>
            <div className="text-xs text-slate-400">Failed</div>
          </div>
          <div className="bg-orange-900/30 border border-orange-700/40 rounded-lg py-1">
            <div className="text-orange-400 text-lg font-bold">{errors}</div>
            <div className="text-xs text-slate-400">Errors</div>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {warnings.map((w, i) => (
        <div key={i} className="bg-yellow-900/30 border border-yellow-700 rounded-lg px-3 py-2 mb-2 text-yellow-300 text-xs">
          {w}
        </div>
      ))}

      {/* Filter bar */}
      {results.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {(['all', 'PASS', 'FAIL', 'ERROR', 'SKIPPED'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {f === 'all' ? `All (${results.length})` : `${f} (${results.filter((r) => r.status === f).length})`}
            </button>
          ))}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`text-xs px-2 py-1 rounded ml-auto transition-colors ${autoScroll ? 'bg-blue-800 text-blue-200' : 'bg-slate-700 text-slate-300'}`}
          >
            {autoScroll ? '🔒 Auto-scroll ON' : '🔓 Auto-scroll OFF'}
          </button>
        </div>
      )}

      {/* Results feed */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filteredResults.length === 0 && results.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <div className="text-4xl mb-3">🧪</div>
            <p>Results will appear here in real-time...</p>
          </div>
        )}
        {filteredResults.map((result, i) => (
          <TestCard key={i} result={result} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
