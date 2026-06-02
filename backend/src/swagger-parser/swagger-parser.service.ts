import { Injectable, Logger } from '@nestjs/common';
import SwaggerParser from '@apidevtools/swagger-parser';
import axios from 'axios';
import {
  ParsedSpec,
  ParsedEndpoint,
  ParsedParameter,
  ParsedRequestBody,
  ParsedResponse,
} from './swagger-parser.dto';

@Injectable()
export class SwaggerParserService {
  private readonly logger = new Logger(SwaggerParserService.name);

  async parseSwaggerUrl(swaggerUrl: string, baseUrlOverride?: string): Promise<ParsedSpec> {
    this.logger.log(`Fetching swagger spec from: ${swaggerUrl}`);

    let rawSpec: any;

    try {
      // Fetch the raw spec first
      const response = await axios.get(swaggerUrl, {
        timeout: 15000,
        headers: { Accept: 'application/json, application/yaml, */*' },
        validateStatus: (status) => status < 400, // Throw error on 4xx and 5xx status codes
      });
      rawSpec = response.data;
    } catch (err) {
      let details = err.message;
      if (err.response) {
        const bodyStr = typeof err.response.data === 'object' ? JSON.stringify(err.response.data) : String(err.response.data);
        details = `Status ${err.response.status} (${err.response.statusText || 'Error'}): ${bodyStr.substring(0, 150)}`;
      }
      throw new Error(`Failed to fetch Swagger URL: ${details}. Make sure the URL is reachable and returns a valid JSON/YAML OpenAPI spec.`);
    }

    // Validate the fetched content before parsing
    if (typeof rawSpec === 'string') {
      const trimmed = rawSpec.trim();
      if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<div')) {
        throw new Error(`The URL returned HTML content instead of a JSON/YAML OpenAPI specification. Make sure you are using the RAW JSON/YAML spec URL (e.g. /api/docs-json or /swagger.json) and NOT the interactive Swagger UI HTML page.`);
      }
    } else if (typeof rawSpec === 'object' && rawSpec !== null) {
      if (!rawSpec.openapi && !rawSpec.swagger) {
        const keys = Object.keys(rawSpec).slice(0, 10).join(', ');
        throw new Error(`The URL returned a JSON response, but it is not a valid OpenAPI/Swagger specification. It is missing the root "openapi" or "swagger" version field. (Found JSON keys: ${keys})`);
      }
    }

    let api: any;
    try {
      // Use SwaggerParser to dereference all $ref pointers
      // This handles circular refs by catching the error
      api = await SwaggerParser.dereference(rawSpec, {
        dereference: { circular: 'ignore' }, // ignore circular refs instead of throwing
      });
    } catch (err) {
      this.logger.warn(`Dereference failed, trying validate: ${err.message}`);
      try {
        api = await SwaggerParser.parse(rawSpec);
      } catch (err2) {
        throw new Error(`Invalid OpenAPI/Swagger spec: ${err2.message}`);
      }
    }

    const isOpenApi3 = !!(api.openapi && api.openapi.startsWith('3'));
    const isSwagger2 = !!(api.swagger && api.swagger.startsWith('2'));

    if (!isOpenApi3 && !isSwagger2) {
      throw new Error('Unsupported spec format. Only OpenAPI 2.x and 3.x are supported.');
    }

    // Determine base URL
    const baseUrl = baseUrlOverride || this.extractBaseUrl(api, swaggerUrl, isOpenApi3);

    // Extract security schemes
    const securitySchemes = this.extractSecuritySchemes(api, isOpenApi3);

    // Extract all endpoints
    const endpoints = this.extractEndpoints(api, isOpenApi3);

    return {
      title: api.info?.title || 'Unknown API',
      version: api.info?.version || '1.0',
      baseUrl,
      securitySchemes,
      endpoints,
      openApiVersion: isOpenApi3 ? '3.0' : '2.0',
    };
  }

  private extractBaseUrl(api: any, swaggerUrl: string, isOpenApi3: boolean): string {
    try {
      const specUrl = new URL(swaggerUrl);
      const origin = specUrl.origin;

      if (isOpenApi3) {
        const servers = api.servers;
        if (servers && servers.length > 0) {
          const serverUrl = servers[0].url;
          if (serverUrl.startsWith('http')) return serverUrl;
          return origin + serverUrl;
        }
        return origin;
      } else {
        // Swagger 2.0
        const scheme = api.schemes?.[0] || specUrl.protocol.replace(':', '');
        const host = api.host || specUrl.host;
        const basePath = api.basePath || '';
        return `${scheme}://${host}${basePath}`;
      }
    } catch {
      return swaggerUrl.replace(/\/[^/]*$/, '');
    }
  }

  private extractSecuritySchemes(api: any, isOpenApi3: boolean): Record<string, any> {
    if (isOpenApi3) {
      return api.components?.securitySchemes || {};
    } else {
      return api.securityDefinitions || {};
    }
  }

  private extractEndpoints(api: any, isOpenApi3: boolean): ParsedEndpoint[] {
    const endpoints: ParsedEndpoint[] = [];
    const paths = api.paths || {};
    const globalSecurity = api.security || [];

    for (const [path, pathItem] of Object.entries(paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;

      const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];

      for (const method of methods) {
        const operation = (pathItem as any)[method];
        if (!operation) continue;

        // Skip file upload / multipart only endpoints for now (mark them)
        const requestBody = this.extractRequestBody(operation, isOpenApi3);
        const parameters = this.extractParameters(operation, pathItem as any);
        const responses = this.extractResponses(operation);
        const security = this.extractSecurity(operation, globalSecurity);

        endpoints.push({
          method: method.toUpperCase(),
          path,
          operationId: operation.operationId,
          summary: operation.summary || operation.description,
          parameters,
          requestBody,
          responses,
          security,
          tags: operation.tags || [],
          consumes: operation.consumes || [],
        });
      }
    }

    return endpoints;
  }

  private extractParameters(operation: any, pathItem: any): ParsedParameter[] {
    const params: ParsedParameter[] = [];
    const seen = new Set<string>();

    // Path-level params first, operation-level override
    const allParams = [
      ...(pathItem.parameters || []),
      ...(operation.parameters || []),
    ];

    for (const param of allParams) {
      if (!param || !param.name) continue;
      const key = `${param.in}-${param.name}`;
      if (seen.has(key)) continue;
      seen.add(key);

      params.push({
        name: param.name,
        in: param.in,
        required: !!param.required,
        schema: param.schema || { type: param.type, format: param.format, enum: param.enum },
        description: param.description,
      });
    }

    return params;
  }

  private extractRequestBody(operation: any, isOpenApi3: boolean): ParsedRequestBody | undefined {
    if (isOpenApi3) {
      const rb = operation.requestBody;
      if (!rb) return undefined;

      const content = rb.content || {};

      // Check for multipart
      if (content['multipart/form-data']) {
        return {
          required: !!rb.required,
          contentType: 'multipart/form-data',
          schema: content['multipart/form-data']?.schema || {},
          isMultipart: true,
        };
      }

      // JSON body
      const jsonContent = content['application/json'];
      if (jsonContent) {
        return {
          required: !!rb.required,
          contentType: 'application/json',
          schema: this.resolveSchema(jsonContent.schema),
          isMultipart: false,
        };
      }

      // Fallback to first available content type
      const firstKey = Object.keys(content)[0];
      if (firstKey) {
        return {
          required: !!rb.required,
          contentType: firstKey,
          schema: this.resolveSchema(content[firstKey]?.schema),
          isMultipart: firstKey === 'multipart/form-data',
        };
      }

      return undefined;
    } else {
      // Swagger 2.0 - body parameter
      const bodyParam = (operation.parameters || []).find((p: any) => p.in === 'body');
      if (!bodyParam) return undefined;

      const consumes = operation.consumes || [];
      const isMultipart = consumes.includes('multipart/form-data');

      return {
        required: !!bodyParam.required,
        contentType: isMultipart ? 'multipart/form-data' : 'application/json',
        schema: this.resolveSchema(bodyParam.schema),
        isMultipart,
      };
    }
  }

  private resolveSchema(schema: any): any {
    if (!schema) return {};

    // Handle circular reference markers (swagger-parser sets these)
    if (schema.$ref) return { type: 'object', _unresolved: true };

    // Handle allOf - merge all schemas
    if (schema.allOf && Array.isArray(schema.allOf)) {
      const merged = { type: 'object', properties: {}, required: [] as string[] };
      for (const sub of schema.allOf) {
        const resolved = this.resolveSchema(sub);
        if (resolved.properties) {
          Object.assign(merged.properties, resolved.properties);
        }
        if (resolved.required && Array.isArray(resolved.required)) {
          merged.required = [...merged.required, ...resolved.required];
        }
      }
      return merged;
    }

    // Handle oneOf / anyOf - take the first non-null option
    if (schema.oneOf && Array.isArray(schema.oneOf)) {
      const nonNull = schema.oneOf.find((s: any) => s.type !== 'null');
      return this.resolveSchema(nonNull || schema.oneOf[0]);
    }

    if (schema.anyOf && Array.isArray(schema.anyOf)) {
      const nonNull = schema.anyOf.find((s: any) => s.type !== 'null');
      return this.resolveSchema(nonNull || schema.anyOf[0]);
    }

    return schema;
  }

  private extractResponses(operation: any): Record<string, ParsedResponse> {
    const responses: Record<string, ParsedResponse> = {};
    const rawResponses = operation.responses || {};

    for (const [code, response] of Object.entries(rawResponses)) {
      if (!response) continue;
      const r = response as any;
      responses[code] = {
        description: r.description || '',
        schema: r.schema || r.content?.['application/json']?.schema,
      };
    }

    return responses;
  }

  private extractSecurity(operation: any, globalSecurity: any[]): string[] {
    const security = operation.security !== undefined ? operation.security : globalSecurity;
    if (!security || !Array.isArray(security)) return [];
    return security.flatMap((s: any) => Object.keys(s));
  }
}
