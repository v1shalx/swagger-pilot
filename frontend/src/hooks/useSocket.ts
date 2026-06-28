/**
 * @file useSocket.ts
 * @description React hook that manages the WebSocket connection to the
 * SwaggerPilot backend.
 *
 * All test runs are initiated via the `run-tests` socket event. The hook
 * exposes a clean state object and a set of stable callbacks so that
 * components never touch the socket directly.
 *
 * Socket event contract (backend → frontend):
 *  - `connected`        → initial handshake with geminiConfigured flag
 *  - `status`          → phase transitions and live spec metadata
 *  - `warning`         → non-fatal messages shown in the live feed
 *  - `test-result`     → one result per executed test case
 *  - `complete`        → final {@link TestReport} when the run finishes
 *  - `error`           → unrecoverable error during the run
 *  - `ai-insights-result`  → full AI analysis markdown
 *  - `root-cause-result`   → per-failure structured diagnostic
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { TestResult, TestReport, RunTestsConfig, FailureDiagnostic } from '../types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** All phases the audit engine can be in. */
export type Phase =
  | 'idle'
  | 'connecting'
  | 'parsing'
  | 'parsed'
  | 'generating'
  | 'ready'
  | 'running'
  | 'complete'
  | 'error'
  | 'cancelled';

interface SocketState {
  phase: Phase;
  statusMessage: string;
  /** Spec metadata (title, version) returned after parsing. */
  specInfo: any;
  /** Endpoint strings like `"GET /users/{id}"` populated after parse. */
  allEndpoints: string[];
  /** Streaming test results. */
  results: TestResult[];
  /** Final report — only populated in `complete` phase. */
  report: TestReport | null;
  /** Total test count reported by the backend before execution starts. */
  totalTests: number;
  completedTests: number;
  warnings: string[];
  error: string | null;
  isConnected: boolean;
  /** True when the backend has a valid GEMINI_API_KEY in its environment. */
  geminiConfigured: boolean;
  aiInsightsLoading: boolean;
  aiInsights: string | null;
  /** Keyed by `"METHOD-path-testName"` — populated lazily on user request. */
  rootCauses: Record<string, { loading: boolean; text: string | null; diagnostic?: FailureDiagnostic }>;
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

/**
 * Emits a socket event as soon as the socket is connected.
 * If the socket is not yet open, it calls `connect()` first and then
 * waits for the `connect` event before emitting.
 */
function emitWhenConnected(
  socketRef: React.MutableRefObject<Socket | null>,
  connect: () => void,
  event: string,
  payload: unknown,
) {
  if (socketRef.current?.connected) {
    socketRef.current.emit(event, payload);
    return;
  }

  connect();
  const socket = socketRef.current;
  if (!socket) return;

  if (socket.connected) {
    socket.emit(event, payload);
  } else {
    socket.once('connect', () => socket.emit(event, payload));
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  const [state, setState] = useState<SocketState>({
    phase: 'idle',
    statusMessage: '',
    specInfo: null,
    allEndpoints: [],
    results: [],
    report: null,
    totalTests: 0,
    completedTests: 0,
    warnings: [],
    error: null,
    isConnected: false,
    geminiConfigured: false,
    aiInsightsLoading: false,
    aiInsights: null,
    rootCauses: {},
  });

  // ── Socket setup ──────────────────────────────────────────────────────────

  /**
   * Opens the socket connection and registers all event listeners.
   * Safe to call multiple times — no-ops if already connected.
   */
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // Connection lifecycle
    socket.on('connect', () => {
      setState((s) => ({ ...s, isConnected: true }));
    });

    socket.on('disconnect', () => {
      setState((s) => ({ ...s, isConnected: false }));
    });

    // Initial handshake — backend sends geminiConfigured flag
    socket.on('connected', (data: { geminiConfigured?: boolean }) => {
      setState((s) => ({
        ...s,
        isConnected: true,
        geminiConfigured: !!data.geminiConfigured,
      }));
    });

    // Phase transitions and spec metadata
    socket.on('status', (data: any) => {
      setState((s) => ({
        ...s,
        phase: data.phase as Phase,
        statusMessage: data.message,
        specInfo: data.spec || s.specInfo,
        totalTests: data.totalTests || s.totalTests,
        allEndpoints: data.spec?.allEndpoints || s.allEndpoints,
      }));

      // Backend emits `ready` before execution starts; immediately flip to `running`
      if (data.phase === 'ready') {
        setState((s) => ({ ...s, phase: 'running' }));
      }
    });

    // Non-fatal warnings (e.g. auth token expiry, CORS issues)
    socket.on('warning', (data: any) => {
      setState((s) => ({ ...s, warnings: [...s.warnings, data.message] }));
    });

    // One event per executed test case
    socket.on('test-result', (result: TestResult) => {
      setState((s) => ({
        ...s,
        results: [...s.results, result],
        completedTests: result.progress?.completed ?? s.completedTests + 1,
        totalTests: result.progress?.total ?? s.totalTests,
      }));
    });

    // Run finished — full report attached
    socket.on('complete', (data: { report: TestReport }) => {
      setState((s) => ({
        ...s,
        phase: 'complete',
        report: data.report,
        statusMessage: '✅ Audit complete!',
      }));
    });

    // Unrecoverable backend error
    socket.on('error', (data: { message: string }) => {
      setState((s) => ({
        ...s,
        phase: 'error',
        error: data.message,
        statusMessage: `❌ Error: ${data.message}`,
      }));
    });

    // AI executive summary
    socket.on('ai-insights-result', (data: { insights: string }) => {
      setState((s) => ({
        ...s,
        aiInsightsLoading: false,
        aiInsights: data.insights,
      }));
    });

    // Per-failure root-cause diagnostic from Gemini
    socket.on(
      'root-cause-result',
      (data: { testKey: string; analysis: string; diagnostic?: FailureDiagnostic }) => {
        setState((s) => ({
          ...s,
          rootCauses: {
            ...s.rootCauses,
            [data.testKey]: {
              loading: false,
              text: data.analysis,
              diagnostic: data.diagnostic,
            },
          },
        }));
      },
    );
  }, []);

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Kick off a full audit run.
   * Resets all ephemeral state so the UI starts clean on each run.
   */
  const runTests = useCallback(
    (config: RunTestsConfig) => {
      emitWhenConnected(socketRef, connect, 'run-tests', config);

      setState((s) => ({
        phase: 'connecting',
        statusMessage: '🔌 Connecting...',
        specInfo: null,
        // Preserve endpoint list for re-runs on the same spec
        allEndpoints: s.allEndpoints,
        results: [],
        report: null,
        totalTests: 0,
        completedTests: 0,
        warnings: [],
        error: null,
        isConnected: s.isConnected,
        geminiConfigured: s.geminiConfigured,
        aiInsightsLoading: false,
        aiInsights: null,
        rootCauses: {},
      }));
    },
    [connect],
  );

  /** Stop an in-progress run. */
  const cancelTests = useCallback(() => {
    socketRef.current?.emit('cancel-tests');
    setState((s) => ({ ...s, phase: 'cancelled', statusMessage: '⏹️ Cancelled.' }));
  }, []);

  /** Return to the idle cockpit view and clear all run data. */
  const reset = useCallback(() => {
    setState((s) => ({
      phase: 'idle',
      statusMessage: '',
      specInfo: null,
      allEndpoints: [],
      results: [],
      report: null,
      totalTests: 0,
      completedTests: 0,
      warnings: [],
      error: null,
      isConnected: s.isConnected,
      geminiConfigured: s.geminiConfigured,
      aiInsightsLoading: false,
      aiInsights: null,
      rootCauses: {},
    }));
  }, []);

  /**
   * Request the AI executive summary for a completed report.
   * Response arrives via the `ai-insights-result` socket event.
   */
  const requestAiInsights = useCallback((report: TestReport) => {
    if (socketRef.current?.connected) {
      setState((s) => ({ ...s, aiInsightsLoading: true }));
      socketRef.current.emit('request-ai-insights', report);
    }
  }, []);

  /**
   * Request a structured root-cause analysis for a single failed test.
   * Response arrives via the `root-cause-result` socket event.
   *
   * @param testKey - Unique string identifying the test: `"METHOD-path-testName"`
   * @param result  - The raw {@link TestResult} to analyse
   */
  const requestRootCause = useCallback((testKey: string, result: TestResult) => {
    if (socketRef.current?.connected) {
      setState((s) => ({
        ...s,
        rootCauses: {
          ...s.rootCauses,
          [testKey]: { loading: true, text: null },
        },
      }));
      socketRef.current.emit('request-root-cause', { testKey, result });
    }
  }, []);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.disconnect();
    };
  }, [connect]);

  return { state, runTests, cancelTests, reset, requestAiInsights, requestRootCause };
}
