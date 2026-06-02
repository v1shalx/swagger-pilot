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

  async analyzeReport(report: any): Promise<string> {
    if (!this.apiKey) {
      return '### ⚠️ Gemini API Key Not Set\nAI analysis could not be run because the `GEMINI_API_KEY` environment variable is missing on the server.';
    }

    const failedTestsSummary = (report.failedTests || [])
      .slice(0, 15) // limit to top 15 failures to avoid token limits
      .map(
        (t: any) =>
          `- **${t.method} ${t.path}** (${t.testName}): Expected ${t.expected.join(' or ')}, got ${t.actual}. Error: ${t.errorMessage || 'None'}`
      )
      .join('\n');

    const prompt = `You are a Principal QA Intelligence Engineer and Site Reliability Engineer. 
Analyze this API test suite report:

API Title: ${report.title}
Base URL: ${report.baseUrl}
Total Tests Executed: ${report.totalTests}
Passed: ${report.passed} (${report.passRate}% pass rate)
Failed: ${report.failed}
Errors: ${report.errors}
Skipped: ${report.skipped}

Failed Tests (Top 15):
${failedTestsSummary || 'No failures! All tests passed successfully.'}

Provide a high-density, professional QA Executive Summary in Markdown. Do not include markdown code ticks wrapper for the entire response. Structure the response with these sections:
1. **Executive Summary**: General health overview of the API under test.
2. **Failure Pattern Analysis**: Group common issues (e.g. auth issues, schema mismatches, server crashes) and explain why they occurred.
3. **Actionable Recommendations**: Clear, prioritized recommendations for developers to stabilize the API.`;

    try {
      const response = await axios.post(
        `${this.apiUrl}?key=${this.apiKey}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 2048,
          },
        },
        { timeout: 30000 },
      );

      return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI.';
    } catch (err) {
      this.logger.error(`AI Report Analysis failed: ${err.message}`);
      return `### ⚠️ AI Analysis Failed\nAn error occurred while generating insights: ${err.message}`;
    }
  }

  async analyzeFailure(test: any): Promise<string> {
    if (!this.apiKey) {
      return '### ⚠️ Gemini API Key Not Set\nRoot cause analysis is unavailable because the `GEMINI_API_KEY` is not configured on the server.';
    }

    const prompt = `You are a Principal Software Engineer and API Security Expert. 
Analyze this specific failed test case and diagnose the root cause:

Test Name: ${test.testName}
Category: ${test.category}
Method: ${test.method}
Path: ${test.path}
Full URL: ${test.fullUrl}
Expected Status: ${Array.isArray(test.expected) ? test.expected.join(' or ') : test.expected}
Actual Status: ${test.actual ?? 'N/A'}
Error Message: ${test.errorMessage || 'N/A'}

Request Body:
${JSON.stringify(test.requestBody || {}, null, 2)}

Response Body:
${JSON.stringify(test.responseBody || {}, null, 2)}

Provide a concise, high-density Root Cause Diagnostics in Markdown. Do not wrap the entire response in markdown code blocks. Structure it into two clean sections:
1. **Root Cause Analysis**: An explanation of why the test failed (e.g., input sanitization issue, missing database migration, validation rules discrepancy).
2. **Recommended Action / Fix**: Clear, code-level fix or configuration adjustment to solve the bug.`;

    try {
      const response = await axios.post(
        `${this.apiUrl}?key=${this.apiKey}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
        },
        { timeout: 20000 },
      );

      return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No diagnostic output generated.';
    } catch (err) {
      this.logger.error(`AI Failure Analysis failed: ${err.message}`);
      return `### ⚠️ AI Diagnostics Failed\nFailed to run root cause analysis: ${err.message}`;
    }
  }
}

