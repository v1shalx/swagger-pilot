import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { RunTestsDto, AuthType, ApiKeyLocation } from '../swagger-parser/swagger-parser.dto';

@Injectable()
export class AuthHandlerService {
  private readonly logger = new Logger(AuthHandlerService.name);
  private cachedToken: string | null = null;

  async resolveAuthHeaders(dto: RunTestsDto): Promise<Record<string, string>> {
    switch (dto.authType) {
      case AuthType.BEARER:
        return { Authorization: `Bearer ${dto.authValue}` };

      case AuthType.API_KEY:
        if (dto.apiKeyLocation === ApiKeyLocation.HEADER) {
          const keyName = dto.apiKeyName || 'X-API-Key';
          return { [keyName]: dto.authValue || '' };
        }
        return {}; // query param handled separately

      case AuthType.BASIC: {
        const encoded = Buffer.from(dto.authValue || ':').toString('base64');
        return { Authorization: `Basic ${encoded}` };
      }

      case AuthType.AUTO_LOGIN:
        return await this.autoLogin(dto);

      case AuthType.NONE:
      default:
        return {};
    }
  }

  resolveAuthQueryParams(dto: RunTestsDto): Record<string, string> {
    if (
      dto.authType === AuthType.API_KEY &&
      dto.apiKeyLocation === ApiKeyLocation.QUERY
    ) {
      const keyName = dto.apiKeyName || 'api_key';
      return { [keyName]: dto.authValue || '' };
    }
    return {};
  }

  private async autoLogin(dto: RunTestsDto): Promise<Record<string, string>> {
    if (this.cachedToken) {
      return { Authorization: `Bearer ${this.cachedToken}` };
    }

    if (!dto.loginUrl) {
      this.logger.warn('Auto-login requested but no loginUrl provided');
      return {};
    }

    try {
      const response = await axios.post(dto.loginUrl, {
        username: dto.loginUsername,
        password: dto.loginPassword,
        email: dto.loginUsername, // some APIs use email
      }, { timeout: 10000 });

      const data = response.data;
      const token =
        data?.access_token ||
        data?.token ||
        data?.jwt ||
        data?.accessToken ||
        data?.data?.token ||
        data?.data?.access_token;

      if (token) {
        this.cachedToken = token;
        this.logger.log('Auto-login successful, token extracted');
        return { Authorization: `Bearer ${token}` };
      } else {
        this.logger.warn('Auto-login: token not found in response. Keys found: ' + Object.keys(data || {}).join(', '));
        return {};
      }
    } catch (err) {
      this.logger.error(`Auto-login failed: ${err.message}`);
      return {};
    }
  }

  clearCache() {
    this.cachedToken = null;
  }
}
