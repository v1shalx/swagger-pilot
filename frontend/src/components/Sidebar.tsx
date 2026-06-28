/**
 * @file Sidebar.tsx
 * @description Collapsible navigation dock for SwaggerPilot.
 *
 * Renders three tabs — Cockpit, Live Console, and Report — and disables
 * tabs that have no content yet (e.g. Report is disabled until a run finishes).
 * Also shows a persistent Gemini status indicator so interviewers can see at a
 * glance whether AI edge-case generation is active.
 */

import React from 'react';
import {
  Flame,
  Sliders,
  Terminal,
  Activity,
  ChevronLeft,
  ChevronRight,
  Cpu,
} from 'lucide-react';
import { Phase } from '../hooks/useSocket';

interface SidebarProps {
  /** Current phase of the audit engine — drives badge states. */
  phase: Phase;
  /** True once a completed {@link TestReport} is available. */
  hasReport: boolean;
  /** True once at least one streaming result has arrived. */
  hasLogs: boolean;
  activeTab: 'cockpit' | 'live' | 'report';
  onTabChange: (tab: 'cockpit' | 'live' | 'report') => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  /** Whether the backend has a valid GEMINI_API_KEY — shown in the footer. */
  geminiConfigured: boolean;
}

export default function Sidebar({
  phase,
  hasReport,
  hasLogs,
  activeTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse,
  geminiConfigured,
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
      className={`flex flex-col flex-shrink-0 h-screen overflow-hidden border-r border-white/[0.06] bg-[#05070c] transition-[width] duration-300 ease-in-out relative z-30 ${
        isCollapsed ? 'w-[4.5rem]' : 'w-64'
      }`}
    >
      {/* Brand header */}
      <div
        className={`h-16 flex items-center border-b border-white/[0.06] flex-shrink-0 ${
          isCollapsed ? 'justify-center px-0' : 'px-4'
        }`}
      >
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/25 flex-shrink-0">
            <Flame className="h-4 w-4 text-white" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-black text-xs text-white tracking-tight leading-none uppercase whitespace-nowrap">
                SWAGGER<span className="text-blue-400">PILOT</span>
              </span>
              <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400 mt-1">
                API Test Runner
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 py-4 overflow-y-auto overflow-x-hidden scrollbar-thin ${isCollapsed ? 'px-2' : 'px-3'}`}>
        {!isCollapsed && (
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-2 block mb-3 font-mono">
            Navigation
          </span>
        )}
        <div className={`space-y-1 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isEnabled = item.enabled;

            if (isCollapsed) {
              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.label}
                  onClick={() => isEnabled && onTabChange(item.id)}
                  disabled={!isEnabled}
                  className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all outline-none ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40 ring-2 ring-blue-400/30'
                      : isEnabled
                        ? 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.06]'
                        : 'text-slate-600 cursor-not-allowed opacity-40'
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.5 : 2} />
                </button>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => isEnabled && onTabChange(item.id)}
                disabled={!isEnabled}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all outline-none border-l-[3px] ${
                  isActive
                    ? 'border-l-blue-500 bg-blue-600/15 text-blue-300 font-bold'
                    : isEnabled
                      ? 'border-l-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                      : 'border-l-transparent text-slate-600 cursor-not-allowed opacity-50'
                }`}
              >
                <Icon className={`h-[18px] w-[18px] flex-shrink-0 ${isActive ? 'text-blue-400' : ''}`} />
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className="truncate text-left">{item.label}</span>
                  {item.badge && (
                    <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded leading-none flex-shrink-0 ml-1 ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer status + collapse */}
      <div className={`flex-shrink-0 border-t border-white/[0.06] bg-[#03050a] ${isCollapsed ? 'px-2 py-3' : 'p-3'}`}>
        <div className={`flex flex-col gap-2 ${isCollapsed ? 'items-center' : ''}`}>
          <div
            className={`flex items-center rounded-lg bg-[#05070c] border border-white/[0.06] ${
              isCollapsed ? 'justify-center w-10 h-9' : 'gap-2 p-2 w-full'
            }`}
            title="Engine Ready"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider leading-none">Engine Ready</span>
                <span className="text-[8px] text-slate-500 mt-1">Test runner active</span>
              </div>
            )}
          </div>

          <div
            className={`flex items-center rounded-lg bg-[#05070c] border border-white/[0.06] ${
              isCollapsed ? 'justify-center w-10 h-9' : 'gap-2 p-2 w-full'
            }`}
            title={geminiConfigured ? 'Gemini online' : 'Gemini not configured'}
          >
            <Cpu className={`h-4 w-4 flex-shrink-0 ${geminiConfigured ? 'text-purple-400' : 'text-slate-500'}`} />
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className={`text-[9px] font-bold uppercase tracking-wider leading-none ${geminiConfigured ? 'text-purple-300' : 'text-slate-500'}`}>
                  Gemini {geminiConfigured ? 'Online' : 'Offline'}
                </span>
                <span className="text-[8px] text-slate-500 mt-1 truncate">
                  {geminiConfigured ? 'API key configured' : 'Not configured'}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleCollapse}
            className={`flex items-center justify-center rounded-lg border border-white/[0.08] bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-all outline-none ${
              isCollapsed ? 'w-10 h-8' : 'w-full h-8 gap-2 text-[10px] font-bold uppercase tracking-wider'
            }`}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <>
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
