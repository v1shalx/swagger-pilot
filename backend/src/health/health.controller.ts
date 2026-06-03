import { Controller, Get } from '@nestjs/common';
import { TestGeneratorService } from '../test-generator/test-generator.service';

@Controller()
export class HealthController {
  constructor(private readonly testGenerator: TestGeneratorService) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'swagger-pilot',
      version: '1.0.0',
      geminiConfigured: this.testGenerator.getGeminiService().isConfigured(),
    };
  }
}
