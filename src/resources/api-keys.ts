/**
 * API Keys Resource
 */

import type { HttpClient } from '../utils/http';
import type {
  ApiKey,
  CreateApiKeyParams,
  CreateApiKeyResult,
  PaginatedResponse,
} from '../types';

interface ApiApiKey {
  id: string;
  tenant_id: string;
  name: string;
  key_prefix: string;
  environment: string;
  scopes: string[];
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

interface ListApiKeysApiResponse {
  api_keys: ApiApiKey[];
  total: number;
}

interface CreateApiKeyApiResponse {
  api_key: ApiApiKey;
  key: string;
}

function transformApiKey(data: ApiApiKey): ApiKey {
  return {
    id: data.id,
    tenantId: data.tenant_id,
    name: data.name,
    keyPrefix: data.key_prefix,
    environment: data.environment as ApiKey['environment'],
    scopes: data.scopes,
    expiresAt: data.expires_at,
    lastUsedAt: data.last_used_at,
    createdAt: data.created_at,
  };
}

export class ApiKeysResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List all API keys
   */
  async list(): Promise<PaginatedResponse<ApiKey>> {
    const response = await this.http.get<ListApiKeysApiResponse>('/v1/api-keys');
    return {
      data: response.api_keys.map(transformApiKey),
      total: response.total,
      hasMore: false,
    };
  }

  /**
   * Get an API key by ID
   */
  async get(keyId: string): Promise<ApiKey> {
    const response = await this.http.get<{ api_key: ApiApiKey }>(`/v1/api-keys/${keyId}`);
    return transformApiKey(response.api_key);
  }

  /**
   * Create a new API key
   * @returns The created API key and the plaintext key (only returned once)
   *
   * @example
   * ```typescript
   * const { apiKey, key } = await veroai.apiKeys.create({
   *   name: 'Production Key',
   *   environment: 'production',
   *   scopes: ['channels:read', 'channels:write', 'messages:send'],
   * });
   *
   * // Save this key securely - it won't be shown again!
   * console.log('API Key:', key); // sk_live_abc123...
   * ```
   */
  async create(params: CreateApiKeyParams): Promise<CreateApiKeyResult> {
    const response = await this.http.post<CreateApiKeyApiResponse>('/v1/api-keys', {
      name: params.name,
      environment: params.environment,
      scopes: params.scopes,
      expires_at: params.expiresAt instanceof Date
        ? params.expiresAt.toISOString()
        : params.expiresAt,
    });
    return {
      apiKey: transformApiKey(response.api_key),
      key: response.key,
    };
  }

  /**
   * Delete (revoke) an API key
   */
  async delete(keyId: string): Promise<void> {
    await this.http.delete(`/v1/api-keys/${keyId}`);
  }

  /**
   * Alias for delete - revoke an API key
   */
  async revoke(keyId: string): Promise<void> {
    return this.delete(keyId);
  }
}
