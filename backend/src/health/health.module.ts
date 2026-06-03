import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { TestGeneratorModule } from '../test-generator/test-generator.module';

@Module({
  imports: [TestGeneratorModule],
  controllers: [HealthController],
})
export class HealthModule {}
