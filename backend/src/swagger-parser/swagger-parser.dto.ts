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

  /** e.g. ["GET /users/{id}", "POST /users"] — empty/undefined = run all */
  @IsOptional()
  selectedEndpoints?: string[];

  /** Second identity for IDOR testing */
  @IsOptional()
  @IsEnum(AuthType)
  secondAuthType?: AuthType;

  @IsOptional()
  @IsString()
  secondAuthValue?: string;

  @IsOptional()
  @IsString()
  secondApiKeyName?: string;

  @IsOptional()
  @IsEnum(ApiKeyLocation)
  secondApiKeyLocation?: ApiKeyLocation;

  @IsOptional()
  @IsString()
  secondLoginUrl?: string;

  @IsOptional()
  @IsString()
  secondLoginUsername?: string;

  @IsOptional()
  @IsString()
  secondLoginPassword?: string;

  /** Run IDOR/authorization tests */
  @IsOptional()
  runIdorTests?: boolean;

  /** Run request-chain tests (create→read→delete) */
  @IsOptional()
  runChainTests?: boolean;

  /** Save baseline to this file path (CLI) */
  @IsOptional()
  @IsString()
  saveBaseline?: string;

  /** Compare against baseline file path (CLI) */
  @IsOptional()
  @IsString()
  baselineFile?: string;
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
