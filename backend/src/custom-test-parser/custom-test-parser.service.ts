import { Injectable, Logger } from "@nestjs/common";
import { GeneratedTest } from "../test-generator/rule-engine.service";

@Injectable()
export class CustomTestParserService {
  private readonly logger = new Logger(CustomTestParserService.name);

  /**
   * Parses uploaded file content into GeneratedTest array
   * Supports: JSON array, CSV
   * Excel (.xlsx) is converted to CSV on frontend before sending
   */
  parseFileContent(content: string, fileType: "json" | "csv"): GeneratedTest[] {
    try {
      if (fileType === "json") {
        return this.parseJson(content);
      } else {
        return this.parseCsv(content);
      }
    } catch (err) {
      this.logger.error(`Failed to parse custom tests: ${err.message}`);
      throw new Error(`Failed to parse file: ${err.message}`);
    }
  }

  private parseJson(content: string): GeneratedTest[] {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      throw new Error("JSON file must contain an array of test cases");
    }

    return parsed.map((item: any, index: number) => {
      if (!item.method || !item.path) {
        throw new Error(
          `Row ${index + 1}: missing required fields "method" and "path"`,
        );
      }

      return {
        testName: item.testName || item.test_name || `Custom Test ${index + 1}`,
        method: String(item.method).toUpperCase(),
        path: item.path,
        headers: item.headers || {},
        queryParams: item.queryParams || item.query_params || {},
        body: this.parseBody(item.body),
        expectedStatus: this.parseExpectedStatus(
          item.expectedStatus || item.expected_status || item.expected,
        ),
        category: "custom",
        description:
          item.description || item.testName || `Custom test case ${index + 1}`,
        isSkipped: false,
      };
    });
  }

  private parseCsv(content: string): GeneratedTest[] {
    const lines = content.split("\n").filter((l) => l.trim());
    if (lines.length < 2)
      throw new Error("CSV must have a header row and at least one test row");

    // Parse header - normalize column names
    const headers = lines[0].split(",").map((h) =>
      h
        .trim()
        .toLowerCase()
        .replace(/[^a-z_]/g, "")
        .replace(/ /g, "_"),
    );

    const tests: GeneratedTest[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Handle commas inside JSON body by splitting carefully
      const values = this.splitCsvLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = (values[idx] || "").trim().replace(/^"|"$/g, "");
      });

      if (!row.method || !row.path) {
        this.logger.warn(`Row ${i + 1} skipped: missing method or path`);
        continue;
      }

      tests.push({
        testName:
          row.test_name || row.testname || row.name || `Custom Test ${i}`,
        method: row.method.toUpperCase(),
        path: row.path,
        headers: {},
        queryParams: {},
        body: this.parseBody(row.body || row.request_body || row.requestbody),
        expectedStatus: this.parseExpectedStatus(
          row.expected_status ||
            row.expectedstatus ||
            row.expected ||
            row.status,
        ),
        category: "custom",
        description:
          row.description || row.test_name || `Custom test case ${i}`,
        isSkipped: false,
      });
    }

    if (tests.length === 0)
      throw new Error("No valid test cases found in file");
    return tests;
  }

  private parseBody(body: any): any {
    if (!body || body === "" || body === "{}") return undefined;
    if (typeof body === "object") return body;
    try {
      return JSON.parse(body);
    } catch {
      return body; // return as string if not valid JSON
    }
  }

  private parseExpectedStatus(val: any): number[] {
    if (!val) return [200, 201];
    if (Array.isArray(val)) return val.map(Number);
    const str = String(val).trim();
    // Handle "400,422" or "400 or 422" or "400"
    if (str.includes(","))
      return str
        .split(",")
        .map((s) => Number(s.trim()))
        .filter(Boolean);
    if (str.includes("or"))
      return str
        .split("or")
        .map((s) => Number(s.trim()))
        .filter(Boolean);
    const num = Number(str);
    return isNaN(num) ? [200] : [num];
  }

  // Handles CSV lines with JSON inside quotes
  private splitCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    let depth = 0;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && depth === 0) {
        inQuotes = !inQuotes;
      } else if ((char === "{" || char === "[") && !inQuotes) {
        depth++;
        current += char;
      } else if ((char === "}" || char === "]") && !inQuotes) {
        depth--;
        current += char;
      } else if (char === "," && !inQuotes && depth === 0) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }
}
