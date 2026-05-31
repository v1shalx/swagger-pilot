import { Module } from '@nestjs/common';
import { TestGeneratorService } from './test-generator.service';
import { RuleEngineService } from './rule-engine.service';
import { GeminiService } from './gemini.service';

@Module({
  providers: [TestGeneratorService, RuleEngineService, GeminiService],
  exports: [TestGeneratorService],
})
export class TestGeneratorModule {}
