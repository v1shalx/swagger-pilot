import { Injectable, Logger } from '@nestjs/common';
import { ParsedSpec } from '../swagger-parser/swagger-parser.dto';
import { RuleEngineService, GeneratedTest } from './rule-engine.service';
import { GeminiService } from './gemini.service';

export interface EndpointTestPlan {
  endpoint: string;
  method: string;
  summary?: string;
  tests: GeneratedTest[];
  skipped: boolean;
  skipReason?: string;
}

@Injectable()
export class TestGeneratorService {
  private readonly logger = new Logger(TestGeneratorService.name);

  constructor(
    private readonly ruleEngine: RuleEngineService,
    private readonly geminiService: GeminiService,
  ) {}

  async generateAllTests(
    spec: ParsedSpec,
    hasAuth: boolean,
    skipAi = false,
  ): Promise<EndpointTestPlan[]> {
    const plans: EndpointTestPlan[] = [];

    for (const endpoint of spec.endpoints) {
      this.logger.log(`Generating tests for ${endpoint.method} ${endpoint.path}`);

      // Layer 1: Rule-based (always runs)
      const ruleTests = this.ruleEngine.generateTests(endpoint, hasAuth);

      // Check if endpoint was fully skipped
      const isFullySkipped = ruleTests.every((t) => t.isSkipped);

      if (isFullySkipped) {
        plans.push({
          endpoint: endpoint.path,
          method: endpoint.method,
          summary: endpoint.summary,
          tests: ruleTests,
          skipped: true,
          skipReason: ruleTests[0]?.skipReason,
        });
        continue;
      }

      // Layer 2: Gemini AI (bonus, optional)
      let aiTests: GeneratedTest[] = [];
      if (!skipAi) {
        aiTests = await this.geminiService.generateEdgeCases(endpoint, ruleTests);
      }

      plans.push({
        endpoint: endpoint.path,
        method: endpoint.method,
        summary: endpoint.summary,
        tests: [...ruleTests, ...aiTests],
        skipped: false,
      });
    }

    return plans;
  }

  countTotalTests(plans: EndpointTestPlan[]): number {
    return plans.reduce((sum, plan) => sum + plan.tests.filter((t) => !t.isSkipped).length, 0);
  }
}
