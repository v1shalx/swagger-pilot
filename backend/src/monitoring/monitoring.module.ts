/**
 * @file monitoring.module.ts
 * @description NestJS module that registers the monitoring service and controller.
 *
 * To enable monitoring, add the following to backend/.env:
 *   MONITORING_URLS=https://api.example.com/openapi.json,http://localhost:3003/api/docs-json
 *   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ
 *   MONITOR_INTERVAL_MINUTES=5
 *
 * If MONITORING_URLS is empty or absent, the service silently no-ops.
 */

import { Module } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';

@Module({
  providers:   [MonitoringService],
  controllers: [MonitoringController],
  exports:     [MonitoringService],
})
export class MonitoringModule {}
