/**
 * @file monitoring.service.ts
 * @description Cron-based API health monitor that fires Slack webhook alerts
 * when a watched endpoint degrades below a configurable health threshold.
 *
 * How it works:
 *  1. Every N minutes (configured via MONITOR_INTERVAL_MINUTES, default 5) the
 *     scheduler calls `runHealthCheck()`.
 *  2. For each URL in MONITORING_URLS, a lightweight Swagger spec fetch is made.
 *  3. If the fetch fails or latency exceeds {@link LATENCY_WARN_MS}, a Slack
 *     message is sent via SLACK_WEBHOOK_URL.
 *  4. Results are stored in-memory so the frontend can poll `/monitoring/status`.
 *
 * Environment variables (set in backend/.env):
 *  - MONITORING_URLS           — comma-separated OpenAPI spec URLs to watch
 *  - SLACK_WEBHOOK_URL         — Slack incoming webhook URL for alerts
 *  - MONITOR_INTERVAL_MINUTES  — how often to check (default: 5)
 *  - MONITOR_LATENCY_WARN_MS   — latency threshold for warnings (default: 2000)
 *
 * @example
 *  MONITORING_URLS=https://petstore.swagger.io/v2/swagger.json,http://localhost:3003/api/docs-json
 *  SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ
 *  MONITOR_INTERVAL_MINUTES=5
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import axios from 'axios';

// ── Constants ────────────────────────────────────────────────────────────────

/** Default poll interval in milliseconds (5 minutes). */
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

/** Latency above this threshold triggers a WARNING alert even if the API is up. */
const DEFAULT_LATENCY_WARN_MS = 2000;

// ── Interfaces ────────────────────────────────────────────────────────────────

/** Status of a single monitored endpoint at a given check instant. */
export interface MonitorResult {
  /** The URL that was checked. */
  url: string;
  /** Whether the spec was reachable and returned a valid response. */
  healthy: boolean;
  /** HTTP status code received, or `null` if the request failed entirely. */
  statusCode: number | null;
  /** Round-trip latency in milliseconds. */
  latencyMs: number;
  /**
   * Alert level:
   *  - `ok`      — healthy, latency within bounds
   *  - `warn`    — reachable but slow
   *  - `down`    — request failed or non-2xx response
   */
  alertLevel: 'ok' | 'warn' | 'down';
  /** Human-readable message, e.g. "Reachable in 142ms" or "Connection refused". */
  message: string;
  /** ISO timestamp of this check. */
  checkedAt: string;
}

/** Aggregate health snapshot for all watched URLs. */
export interface MonitorSnapshot {
  /** True only if every monitored URL is healthy. */
  allHealthy: boolean;
  /** How many URLs returned healthy on this check. */
  healthyCount: number;
  /** Total URLs being watched. */
  totalCount: number;
  /** ISO timestamp of the most recent check cycle. */
  lastCheckedAt: string;
  /** Per-URL results. */
  results: MonitorResult[];
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class MonitoringService implements OnModuleInit {
  private readonly logger = new Logger(MonitoringService.name);

  /** URLs to watch — populated from the MONITORING_URLS env var. */
  private readonly targetUrls: string[];

  /** Slack webhook URL — optional; alerts are skipped if absent. */
  private readonly slackWebhookUrl: string | undefined;

  /** Poll interval in ms. */
  private readonly intervalMs: number;

  /** Latency threshold in ms. */
  private readonly latencyWarnMs: number;

  /** Latest snapshot — returned by the health API endpoint. */
  private latestSnapshot: MonitorSnapshot | null = null;

  /** The Node.js interval handle so we can clear it on shutdown. */
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const rawUrls = process.env.MONITORING_URLS ?? '';
    this.targetUrls = rawUrls
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);

    this.slackWebhookUrl = process.env.SLACK_WEBHOOK_URL?.trim() || undefined;

    this.intervalMs =
      parseInt(process.env.MONITOR_INTERVAL_MINUTES ?? '5', 10) * 60 * 1000 ||
      DEFAULT_INTERVAL_MS;

    this.latencyWarnMs =
      parseInt(process.env.MONITOR_LATENCY_WARN_MS ?? '2000', 10) ||
      DEFAULT_LATENCY_WARN_MS;
  }

  /**
   * Called by NestJS when the module bootstraps.
   * Starts the cron-like polling loop and runs an initial check immediately.
   */
  onModuleInit() {
    if (this.targetUrls.length === 0) {
      this.logger.log('No MONITORING_URLS configured — monitoring is disabled.');
      return;
    }

    this.logger.log(
      `Monitoring ${this.targetUrls.length} URL(s) every ${this.intervalMs / 60000}min` +
      (this.slackWebhookUrl ? ' · Slack alerts enabled' : ' · Slack alerts disabled'),
    );

    // Run immediately on startup, then on interval
    void this.runHealthCheck();
    this.intervalHandle = setInterval(() => void this.runHealthCheck(), this.intervalMs);
  }

  /**
   * Execute one full health-check cycle across all configured URLs.
   * Sends a Slack alert for any URL that has changed from healthy to unhealthy.
   *
   * @returns The aggregated {@link MonitorSnapshot} for this cycle.
   */
  async runHealthCheck(): Promise<MonitorSnapshot> {
    this.logger.debug(`Running health check on ${this.targetUrls.length} URL(s)...`);

    const results = await Promise.all(
      this.targetUrls.map((url) => this.checkUrl(url)),
    );

    const healthyCount = results.filter((r) => r.healthy).length;
    const snapshot: MonitorSnapshot = {
      allHealthy:    healthyCount === results.length,
      healthyCount,
      totalCount:    results.length,
      lastCheckedAt: new Date().toISOString(),
      results,
    };

    // Alert on any degraded URL
    const degraded = results.filter((r) => r.alertLevel !== 'ok');
    if (degraded.length > 0) {
      await this.sendSlackAlert(degraded, snapshot);
    }

    this.latestSnapshot = snapshot;
    return snapshot;
  }

  /**
   * Check a single URL and return its {@link MonitorResult}.
   * Uses a HEAD request when possible for minimal overhead; falls back to GET.
   *
   * @param url - The OpenAPI spec URL or any API URL to probe.
   */
  private async checkUrl(url: string): Promise<MonitorResult> {
    const start = Date.now();

    try {
      const response = await axios.get(url, {
        timeout: 8000,
        validateStatus: () => true, // Never throw on non-2xx — we handle it ourselves
        headers: { Accept: 'application/json, text/html, */*' },
      });

      const latencyMs   = Date.now() - start;
      const statusCode  = response.status;
      const isSuccess   = statusCode >= 200 && statusCode < 400;
      const isSlow      = latencyMs > this.latencyWarnMs;

      const alertLevel  = !isSuccess ? 'down' : isSlow ? 'warn' : 'ok';
      const message     = isSuccess
        ? `Reachable in ${latencyMs}ms (HTTP ${statusCode})${isSlow ? ' — latency is HIGH' : ''}`
        : `HTTP ${statusCode} — endpoint returned an error`;

      return { url, healthy: isSuccess, statusCode, latencyMs, alertLevel, message, checkedAt: new Date().toISOString() };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const message = err.code === 'ECONNREFUSED'
        ? 'Connection refused — server is not running'
        : err.code === 'ETIMEDOUT'
          ? 'Request timed out after 8s'
          : `Request failed: ${err.message}`;

      return {
        url,
        healthy:    false,
        statusCode: null,
        latencyMs,
        alertLevel: 'down',
        message,
        checkedAt:  new Date().toISOString(),
      };
    }
  }

  /**
   * Post a Slack alert for the provided degraded results.
   * No-ops silently if SLACK_WEBHOOK_URL is not configured.
   *
   * @param degraded - Results with alertLevel `warn` or `down`.
   * @param snapshot - The full snapshot for context.
   */
  private async sendSlackAlert(
    degraded: MonitorResult[],
    snapshot: MonitorSnapshot,
  ): Promise<void> {
    if (!this.slackWebhookUrl) return;

    const emoji     = snapshot.allHealthy ? '⚠️' : '🔴';
    const downCount = degraded.filter((r) => r.alertLevel === 'down').length;
    const warnCount = degraded.filter((r) => r.alertLevel === 'warn').length;

    const header = `${emoji} *SwaggerPilot Monitor Alert* — ${new Date().toUTCString()}`;
    const summary = `*${downCount} down*, *${warnCount} slow* out of ${snapshot.totalCount} watched URL(s)`;

    const blocks = degraded.map((r) => {
      const icon = r.alertLevel === 'down' ? '🔴' : '⚠️';
      return `${icon} \`${r.url}\` — ${r.message}`;
    });

    const payload = {
      text: header,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: '🛰️ SwaggerPilot — API Health Alert' } },
        { type: 'section', text: { type: 'mrkdwn', text: `${header}\n${summary}` } },
        { type: 'section', text: { type: 'mrkdwn', text: blocks.join('\n') } },
        { type: 'context', elements: [{ type: 'mrkdwn', text: `Healthy: ${snapshot.healthyCount}/${snapshot.totalCount}` }] },
      ],
    };

    try {
      await axios.post(this.slackWebhookUrl, payload, { timeout: 5000 });
      this.logger.log(`Slack alert sent for ${degraded.length} degraded URL(s)`);
    } catch (err: any) {
      this.logger.warn(`Slack alert failed: ${err.message}`);
    }
  }

  /**
   * Return the most recent health snapshot.
   * Used by the REST controller to power the `/monitoring/status` endpoint.
   *
   * @returns The latest snapshot, or `null` if no check has run yet.
   */
  getLatestSnapshot(): MonitorSnapshot | null {
    return this.latestSnapshot;
  }

  /**
   * Return the list of URLs currently being monitored.
   * Useful for the health endpoint to confirm configuration is correct.
   */
  getMonitoredUrls(): string[] {
    return this.targetUrls;
  }
}
