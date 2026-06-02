import React from 'react';
import { 
  Flame, 
  Sliders, 
  Terminal, 
  Activity, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight,
  Shield,
  Cpu
} from 'lucide-react';
import { Phase } from '../hooks/useSocket';

interface SidebarProps {
  phase: Phase;
  hasReport: boolean;
  hasLogs: boolean;
  activeTab: 'cockpit' | 'live' | 'report';
  onTabChange: (tab: 'cockpit' | 'live' | 'report') => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({
  phase,
  hasReport,
  hasLogs,
  activeTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const isRunning = ['connecting', 'parsing', 'parsed', 'generating', 'running'].includes(phase);

  const menuItems = [
    {
      id: 'cockpit' as const,
      label: 'Auditing Cockpit',
      icon: Sliders,
      badge: isRunning ? 'Active' : null,
      badgeColor: 'badge-neon-blue',
      enabled: true,
    },
    {
      id: 'live' as const,
      label: 'Live Console Stream',
      icon: Terminal,
      badge: isRunning ? 'Running' : hasLogs ? 'Logs' : null,
      badgeColor: isRunning ? 'badge-neon-purple animate-pulse' : 'badge-neon-blue',
      enabled: isRunning || hasLogs,
    },
    {
      id: 'report' as const,
      label: 'QA Dashboard Report',
      icon: Activity,
      badge: hasReport ? 'Ready' : null,
      badgeColor: 'badge-neon-emerald',
      enabled: hasReport,
    },
  ];

  return (
    <aside 
      className={`glass-panel border-r border-white/[0.04] bg-[#05070c]/70 flex flex-col transition-all duration-300 relative z-30 h-screen ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center px-4 border-b border-white/[0.04] justify-between overflow-hidden">
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="h-8 w-8 rounded bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Flame className="h-4.5 w-4.5 text-white" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-black text-xs text-white tracking-tight leading-none uppercase">
                SWAGGER<span className="text-blue-500">PILOT</span>
              </span>
              <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 mt-1">
                QA Intelligence v1
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto scrollbar-thin">
        {!isCollapsed && (
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-2.5 block mb-2 font-mono">
            Navigation
          </span>
        )}
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isEnabled = item.enabled;

          return (
            <button
              key={item.id}
              onClick={() => isEnabled && onTabChange(item.id)}
              disabled={!isEnabled}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all border outline-none ${
                isActive
                  ? 'bg-blue-600/10 border-blue-500/30 text-blue-400 font-bold shadow-md shadow-blue-900/10'
                  : isEnabled
                    ? 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30 hover:border-white/[0.02]'
                    : 'bg-transparent border-transparent text-slate-650 cursor-not-allowed'
              }`}
            >
              <Icon className={`h-4.5 w-4.5 flex-shrink-0 ${isActive ? 'text-blue-450' : isEnabled ? 'text-slate-450' : 'text-slate-700'}`} />
              
              {!isCollapsed && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded leading-none ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Cluster Status Footer Section */}
      <div className="p-3 border-t border-white/[0.04] bg-[#03050a]/40">
        <div className="flex flex-col gap-2">
          {/* Environment status indicator */}
          <div className={`flex items-center gap-2 rounded-lg p-2 bg-[#05070c]/80 border border-white/[0.03] ${isCollapsed ? 'justify-center' : ''}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">CLUSTER ONLINE</span>
                <span className="text-[8px] text-slate-550 mt-1 truncate">secure_mode:active</span>
              </div>
            )}
          </div>

          {/* Gemini connection node status */}
          <div className={`flex items-center gap-2 rounded-lg p-2 bg-[#05070c]/80 border border-white/[0.03] ${isCollapsed ? 'justify-center' : ''}`}>
            <Cpu className="h-3.5 w-3.5 text-purple-400 flex-shrink-0" />
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] font-bold text-purple-400 uppercase tracking-wider leading-none">GEMINI WATCHDOG</span>
                <span className="text-[8px] text-slate-550 mt-1 truncate">model_temp:0.1</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toggle collapse action trigger */}
      <button
        onClick={onToggleCollapse}
        className="absolute bottom-16 -right-3 h-6 w-6 rounded-full bg-slate-900 border border-white/[0.08] flex items-center justify-center hover:bg-slate-800 text-slate-450 hover:text-white transition-all shadow-md z-40 outline-none"
      >
        {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </aside>
  );
}
