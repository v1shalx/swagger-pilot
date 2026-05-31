import { Module } from '@nestjs/common';
import { SwaggerParserService } from './swagger-parser.service';

@Module({
  providers: [SwaggerParserService],
  exports: [SwaggerParserService],
})
export class SwaggerParserModule {}
