/**
 * @file monitoring.controller.ts
 * @description REST endpoints that expose the live monitoring status to the frontend
 * and allow on-demand health checks to be triggered without waiting for the cron cycle.
 *
 * Endpoints:
 *  GET  /monitoring/status   → Returns the latest {@link MonitorSnapshot}
 *  POST /monitoring/check    → Triggers an immediate health check and returns results
 *  GET  /monitoring/urls     → Lists the configured monitoring targets
 */

import { Controller, Get, Post } from '@nestjs/common';
import { MonitoringService, MonitorSnapshot } from './monitoring.service';

@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  /**
   * Returns the most recent health snapshot.
   * The frontend polls this every 30 seconds to update the status dashboard.
   *
   * @returns The cached {@link MonitorSnapshot}, or a no-config message if
   *          monitoring is not set up.
   */
  @Get('status')
  getStatus(): MonitorSnapshot | { message: string } {
    const snapshot = this.monitoringService.getLatestSnapshot();
    if (!snapshot) {
      return { message: 'No health check has run yet. Configure MONITORING_URLS to enable monitoring.' };
    }
    return snapshot;
  }

  /**
   * Triggers an immediate health check across all configured URLs.
   * Useful for on-demand checks from the dashboard without waiting for the cron.
   *
   * @returns A fresh {@link MonitorSnapshot} from this check cycle.
   */
  @Post('check')
  async runCheck(): Promise<MonitorSnapshot | { message: string }> {
    const urls = this.monitoringService.getMonitoredUrls();
    if (urls.length === 0) {
      return { message: 'No MONITORING_URLS configured. Add them to backend/.env to enable monitoring.' };
    }
    return this.monitoringService.runHealthCheck();
  }

  /**
   * Returns the list of URLs currently being monitored.
   * Allows the UI to display the configured targets.
   */
  @Get('urls')
  getUrls(): { urls: string[] } {
    return { urls: this.monitoringService.getMonitoredUrls() };
  }
}
