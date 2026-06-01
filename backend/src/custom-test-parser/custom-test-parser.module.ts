import { Module } from "@nestjs/common";
import { CustomTestParserService } from "./custom-test-parser.service";

@Module({
  providers: [CustomTestParserService],
  exports: [CustomTestParserService],
})
export class CustomTestParserModule {}
