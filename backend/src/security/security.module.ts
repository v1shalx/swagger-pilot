import { Module } from '@nestjs/common';
import { SecurityProbeService } from './security-probe.service';

/**
 * OWASP API Security Top 10 automated probe module.
 * Exported so RunOrchestratorModule can inject SecurityProbeService.
 */
@Module({
  providers: [SecurityProbeService],
  exports:   [SecurityProbeService],
})
export class SecurityModule {}
