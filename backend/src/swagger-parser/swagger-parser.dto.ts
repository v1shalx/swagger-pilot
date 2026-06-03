import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export enum AuthType {
  NONE = 'none',
  BEARER = 'bearer',
  API_KEY = 'apikey',
  BASIC = 'basic',
  AUTO_LOGIN = 'autologin',
}

export enum ApiKeyLocation {
  HEADER = 'header',
  QUERY = 'query',
}

export class RunTestsDto {
  @IsString()
  @IsNotEmpty()
  swaggerUrl: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsEnum(AuthType)
  authType?: AuthType = AuthType.NONE;

  @IsOptional()
  @IsString()
  authValue?: string;

  @IsOptional()
  @IsString()
  apiKeyName?: string;

  @IsOptional()
  @IsEnum(ApiKeyLocation)
  apiKeyLocation?: ApiKeyLocation = ApiKeyLocation.HEADER;

  @IsOptional()
  @IsString()
  loginUrl?: string;

  @IsOptional()
  @IsString()
  loginUsername?: string;

  @IsOptional()
  @IsString()
  loginPassword?: string;

  @IsOptional()
  delayBetweenTests?: number = 100;

  @IsOptional()
  maxConcurrent?: number = 3;

  @IsOptional()
  skipAiGeneration?: boolean = false;

  @IsOptional()
  @IsString()
  runProfile?: 'smoke' | 'full';
}

export interface ParsedEndpoint {
  method: string;
  path: string;
  operationId?: string;
  summary?: string;
  parameters: ParsedParameter[];
  requestBody?: ParsedRequestBody;
  responses: Record<string, ParsedResponse>;
  security?: string[];
  tags?: string[];
  consumes?: string[];
}

export interface ParsedParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required: boolean;
  schema: any;
  description?: string;
}

export interface ParsedRequestBody {
  required: boolean;
  contentType: string;
  schema: any;
  isMultipart: boolean;
}

export interface ParsedResponse {
  description: string;
  schema?: any;
}

export interface ParsedSpec {
  title: string;
  version: string;
  baseUrl: string;
  securitySchemes: Record<string, any>;
  endpoints: ParsedEndpoint[];
  openApiVersion: string;
}
