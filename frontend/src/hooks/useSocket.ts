import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { TestResult, TestReport, RunTestsConfig, DryRunResult } from '../types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

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
  specInfo: any;
  results: TestResult[];
  report: TestReport | null;
  dryRunResult: DryRunResult | null;
  totalTests: number;
  completedTests: number;
  warnings: string[];
  error: string | null;
  isConnected: boolean;
  geminiConfigured: boolean;
  aiInsightsLoading: boolean;
  aiInsights: string | null;
  rootCauses: Record<string, { loading: boolean; text: string | null; diagnostic?: import('../types').FailureDiagnostic }>;
}

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

  const doEmit = () => {
    socket.emit(event, payload);
  };

  if (socket.connected) {
    doEmit();
  } else {
    socket.once('connect', doEmit);
  }
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<SocketState>({
    phase: 'idle',
    statusMessage: '',
    specInfo: null,
    results: [],
    report: null,
    dryRunResult: null,
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

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setState((s) => ({ ...s, isConnected: true }));
    });

    socket.on('disconnect', () => {
      setState((s) => ({ ...s, isConnected: false }));
    });

    socket.on('connected', (data: { geminiConfigured?: boolean }) => {
      setState((s) => ({
        ...s,
        isConnected: true,
        geminiConfigured: !!data.geminiConfigured,
      }));
    });

    socket.on('status', (data: any) => {
      setState((s) => ({
        ...s,
        phase: data.phase as Phase,
        statusMessage: data.message,
        specInfo: data.spec || s.specInfo,
        totalTests: data.totalTests || s.totalTests,
      }));

      if (data.phase === 'ready') {
        setState((s) => ({ ...s, phase: 'running' }));
      }
    });

    socket.on('warning', (data: any) => {
      setState((s) => ({ ...s, warnings: [...s.warnings, data.message] }));
    });

    socket.on('test-result', (result: TestResult) => {
      setState((s) => ({
        ...s,
        results: [...s.results, result],
        completedTests: result.progress?.completed || s.completedTests + 1,
        totalTests: result.progress?.total || s.totalTests,
      }));
    });

    socket.on('complete', (data: { report: TestReport }) => {
      setState((s) => ({
        ...s,
        phase: 'complete',
        report: data.report,
        statusMessage: '✅ Test run complete!',
      }));
    });

    socket.on('dry-run-result', (data: DryRunResult) => {
      setState((s) => ({
        ...s,
        phase: 'idle',
        dryRunResult: data,
        statusMessage: `Dry run: ${data.totalTests} tests would run`,
      }));
    });

    socket.on('error', (data: { message: string }) => {
      setState((s) => ({
        ...s,
        phase: 'error',
        error: data.message,
        statusMessage: `❌ Error: ${data.message}`,
      }));
    });

    socket.on('ai-insights-result', (data: { insights: string }) => {
      setState((s) => ({
        ...s,
        aiInsightsLoading: false,
        aiInsights: data.insights,
      }));
    });

    socket.on('root-cause-result', (data: { testKey: string; analysis: string; diagnostic?: import('../types').FailureDiagnostic }) => {
      setState((s) => ({
        ...s,
        rootCauses: {
          ...s.rootCauses,
          [data.testKey]: { loading: false, text: data.analysis, diagnostic: data.diagnostic },
        },
      }));
    });
  }, []);

  const runTests = useCallback((config: RunTestsConfig) => {
    emitWhenConnected(socketRef, connect, 'run-tests', config);

    setState((s) => ({
      phase: 'connecting',
      statusMessage: '🔌 Connecting...',
      specInfo: null,
      results: [],
      report: null,
      dryRunResult: null,
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
  }, [connect]);

  const dryRun = useCallback((config: RunTestsConfig) => {
    emitWhenConnected(socketRef, connect, 'dry-run', config);
    setState((s) => ({ ...s, phase: 'parsing', statusMessage: '🔍 Running dry run...', dryRunResult: null }));
  }, [connect]);

  const cancelTests = useCallback(() => {
    socketRef.current?.emit('cancel-tests');
    setState((s) => ({ ...s, phase: 'cancelled', statusMessage: '⏹️ Cancelling...' }));
  }, []);

  const reset = useCallback(() => {
    setState((s) => ({
      phase: 'idle',
      statusMessage: '',
      specInfo: null,
      results: [],
      report: null,
      dryRunResult: null,
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

  const requestAiInsights = useCallback((report: TestReport) => {
    if (socketRef.current?.connected) {
      setState((s) => ({ ...s, aiInsightsLoading: true }));
      socketRef.current.emit('request-ai-insights', report);
    }
  }, []);

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

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.disconnect();
    };
  }, [connect]);

  return { state, runTests, dryRun, cancelTests, reset, requestAiInsights, requestRootCause };
}
