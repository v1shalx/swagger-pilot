import { Module } from '@nestjs/common';
import { TestRunnerService } from './test-runner.service';
import { AuthHandlerService } from './auth-handler.service';
import { ChainRunnerService } from './chain-runner.service';
import { IdorCheckerService } from './idor-checker.service';

@Module({
  providers: [TestRunnerService, AuthHandlerService, ChainRunnerService, IdorCheckerService],
  exports: [TestRunnerService, AuthHandlerService, ChainRunnerService, IdorCheckerService],
})
export class TestRunnerModule {}
