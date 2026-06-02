import React, { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import Home from './pages/Home';
import Report from './pages/Report';
import LiveFeed from './components/LiveFeed';
import Sidebar from './components/Sidebar';
import { RefreshCw, ShieldAlert, Cpu } from 'lucide-react';

export default function App() {
  const { state, runTests, dryRun, cancelTests, reset, requestAiInsights, requestRootCause } = useSocket();

  const isRunning = ['connecting', 'parsing', 'parsed', 'generating', 'running'].includes(state.phase);
  const showReport = state.phase === 'complete' && state.report;
  const showLiveFeed = isRunning || (state.results.length > 0 && state.phase !== 'complete');

  const [activeTab, setActiveTab] = useState<'cockpit' | 'live' | 'report'>('cockpit');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Sync automatic tab switching on key state changes
  useEffect(() => {
    if (isRunning) {
      setActiveTab('live');
    } else if (showReport) {
      setActiveTab('report');
    } else if (state.phase === 'idle' && !state.report) {
      setActiveTab('cockpit');
    }
  }, [isRunning, showReport, state.phase, state.report]);

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex overflow-hidden">
      
      {/* Sidebar navigation dock */}
      <Sidebar
        phase={state.phase}
        hasReport={!!state.report}
        hasLogs={state.results.length > 0}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden bg-cyber-grid bg-spotlight relative">
        
        {/* Glow ambient spots overlay */}
        <div className="absolute inset-0 bg-spotlight-success pointer-events-none z-0" />
        <div className="absolute inset-0 bg-spotlight-error pointer-events-none z-0" />

        <div className="flex-1 relative z-10 flex flex-col min-h-0 overflow-y-auto scrollbar-thin">
          
          {/* Active view renderer */}
          {activeTab === 'report' && state.report ? (
            <Report
              report={state.report}
              onReset={() => {
                reset();
                setActiveTab('cockpit');
              }}
              aiInsightsLoading={state.aiInsightsLoading}
              aiInsights={state.aiInsights}
              onRequestAiInsights={requestAiInsights}
              rootCauses={state.rootCauses}
              onRequestRootCause={requestRootCause}
            />
          ) : activeTab === 'live' ? (
            <div className="flex-1 flex flex-col">
              {/* Sleek Top stream bar */}
              <div className="bg-[#05070c]/60 border-b border-white/[0.04] px-6 py-3.5 flex items-center justify-between backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="font-bold text-xs uppercase text-white tracking-widest font-mono">Stream Analyzer Target</span>
                  {state.specInfo && (
                    <span className="text-slate-400 font-bold text-xs font-mono">/ {state.specInfo.title}</span>
                  )}
                </div>
                <button
                  onClick={() => setActiveTab('cockpit')}
                  className="text-[10px] font-extrabold uppercase tracking-wider text-slate-450 hover:text-slate-200 transition-colors bg-slate-900/60 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-white/[0.05] outline-none"
                >
                  ← Config Workspace
                </button>
              </div>

              <div className="flex-1 p-6 overflow-hidden min-h-0">
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

        </div>

      </div>

      {/* Floating System-Level Error Notification */}
      {state.phase === 'error' && (
        <div className="fixed bottom-6 right-6 bg-slate-950/90 border border-rose-900/60 rounded-xl p-4.5 max-w-md shadow-2xl z-50 backdrop-blur-xl animate-bounce-short">
          <div className="flex gap-3">
            <ShieldAlert className="h-5 w-5 text-rose-500 flex-shrink-0" />
            <div>
              <div className="text-rose-400 font-bold text-xs uppercase tracking-wider mb-1 font-mono">Diagnostic Exception</div>
              <div className="text-slate-300 text-xs leading-relaxed font-mono font-medium">{state.error}</div>
              <button 
                onClick={reset} 
                className="mt-3 text-[10px] font-extrabold uppercase tracking-wider text-rose-400 hover:text-rose-350 underline outline-none"
              >
                Dismiss Audit Error
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
