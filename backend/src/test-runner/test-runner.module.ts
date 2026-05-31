import { Module } from '@nestjs/common';
import { TestRunnerService } from './test-runner.service';
import { AuthHandlerService } from './auth-handler.service';

@Module({
  providers: [TestRunnerService, AuthHandlerService],
  exports: [TestRunnerService, AuthHandlerService],
})
export class TestRunnerModule {}
