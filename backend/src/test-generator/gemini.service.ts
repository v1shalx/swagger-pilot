import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ParsedEndpoint } from '../swagger-parser/swagger-parser.dto';
import { GeneratedTest } from './rule-engine.service';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey = process.env.GEMINI_API_KEY;
  private readonly apiUrl =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

  async generateEdgeCases(
    endpoint: ParsedEndpoint,
    existingTests: GeneratedTest[],
  ): Promise<GeneratedTest[]> {
    if (!this.apiKey) {
      this.logger.warn('GEMINI_API_KEY not set — skipping AI test generation');
      return [];
    }

    const prompt = this.buildPrompt(endpoint, existingTests);

    try {
      const response = await axios.post(
        `${this.apiUrl}?key=${this.apiKey}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        },
        { timeout: 30000 },
      );

      const rawText =
        response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      return this.parseGeminiResponse(rawText, endpoint);
    } catch (err) {
      this.logger.warn(`Gemini API failed: ${err.message} — continuing without AI tests`);
      return [];
    }
  }

  private buildPrompt(endpoint: ParsedEndpoint, existingTests: GeneratedTest[]): string {
    const schema = endpoint.requestBody?.schema;
    const existingNames = existingTests.map((t) => t.testName).join('\n');

    return `You are an API test engineer. Generate 5 creative edge case tests for this API endpoint that are NOT already covered by the existing tests.

Endpoint: ${endpoint.method} ${endpoint.path}
Summary: ${endpoint.summary || 'No description'}
Request body schema: ${JSON.stringify(schema || {}, null, 2)}
Response codes in spec: ${Object.keys(endpoint.responses).join(', ')}

Already covered tests:
${existingNames}

Return ONLY a valid JSON array (no markdown, no backticks, no explanation) with this exact structure:
[
  {
    "testName": "descriptive test name",
    "method": "${endpoint.method}",
    "path": "${endpoint.path.replace(/\{[^}]+\}/g, '1')}",
    "headers": {"Content-Type": "application/json"},
    "queryParams": {},
    "body": {},
    "expectedStatus": [400],
    "category": "ai-edge-case",
    "description": "why this test matters"
  }
]

Ideas to consider: SQL injection, XSS in string fields, very large payloads, Unicode/emoji, duplicate entries, concurrent requests simulation, extremely long strings, null values for non-nullable fields, negative numbers for unsigned fields, zero values.`;
  }

  private parseGeminiResponse(rawText: string, endpoint: ParsedEndpoint): GeneratedTest[] {
    try {
      // Strip markdown code blocks if present
      let cleaned = rawText.trim();
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');

      // Find JSON array
      const start = cleaned.indexOf('[');
      const end = cleaned.lastIndexOf(']');
      if (start === -1 || end === -1) {
        this.logger.warn('Gemini response did not contain valid JSON array');
        return [];
      }

      const jsonStr = cleaned.substring(start, end + 1);
      const parsed = JSON.parse(jsonStr);

      if (!Array.isArray(parsed)) return [];

      // Validate and sanitize each test
      return parsed
        .filter((t) => t.testName && t.method && t.path)
        .map((t) => ({
          testName: `[AI] ${t.testName}`,
          method: t.method || endpoint.method,
          path: t.path || endpoint.path,
          headers: t.headers || {},
          queryParams: t.queryParams || {},
          body: t.body !== undefined ? t.body : null,
          expectedStatus: Array.isArray(t.expectedStatus)
            ? t.expectedStatus
            : [t.expectedStatus || 400],
          category: 'ai-edge-case',
          description: t.description || 'AI-generated edge case',
        }))
        .slice(0, 5); // Max 5 AI tests per endpoint
    } catch (err) {
      this.logger.warn(`Failed to parse Gemini response: ${err.message}`);
      return [];
    }
  }
}
