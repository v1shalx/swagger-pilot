import React from 'react';
import { useSocket } from './hooks/useSocket';
import Home from './pages/Home';
import Report from './pages/Report';
import LiveFeed from './components/LiveFeed';

export default function App() {
  const { state, runTests, dryRun, cancelTests, reset } = useSocket();

  const isRunning = ['connecting', 'parsing', 'parsed', 'generating', 'running'].includes(state.phase);
  const showReport = state.phase === 'complete' && state.report;
  const showLiveFeed = isRunning || (state.results.length > 0 && state.phase !== 'complete');

  if (showReport) {
    return <Report report={state.report!} onReset={reset} />;
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {showLiveFeed ? (
        <div className="min-h-screen flex flex-col">
          {/* Top bar */}
          <div className="bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">✈️</span>
              <span className="font-bold text-white">SwaggerPilot</span>
              {state.specInfo && (
                <span className="text-slate-400 text-sm">— {state.specInfo.title}</span>
              )}
            </div>
            <button
              onClick={reset}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              ← Back
            </button>
          </div>

          <div className="flex-1 p-6 overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>
            <LiveFeed
              results={state.results}
              phase={state.phase}
              statusMessage={state.statusMessage}
              totalTests={state.totalTests}
              completedTests={state.completedTests}
              warnings={state.warnings}
              onCancel={cancelTests}
              isRunning={isRunning}
            />
          </div>
        </div>
      ) : (
        <Home
          onRunTests={runTests}
          onDryRun={dryRun}
          dryRunResult={state.dryRunResult}
          isRunning={isRunning}
        />
      )}

      {/* Error display */}
      {state.phase === 'error' && (
        <div className="fixed bottom-4 right-4 bg-red-900 border border-red-600 rounded-xl p-4 max-w-md shadow-xl">
          <div className="text-red-300 font-medium mb-1">❌ Error</div>
          <div className="text-red-200 text-sm">{state.error}</div>
          <button onClick={reset} className="mt-2 text-xs text-red-400 hover:text-red-200 underline">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
