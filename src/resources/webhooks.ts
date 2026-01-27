/**
 * Webhooks Resource
 */

import type { HttpClient } from '../utils/http';
import type {
  Webhook,
  CreateWebhookParams,
  UpdateWebhookParams,
  WebhookDelivery,
  WebhookStats,
  PaginatedResponse,
} from '../types';

interface ApiWebhook {
  id: string;
  tenant_id: string;
  name: string;
  url: string;
  events: string[];
  channel_id: string | null;
  headers: Record<string, string>;
  status: string;
  retry_config: {
    enabled: boolean;
    max_attempts: number;
    backoff: string;
  };
  created_at: string;
  updated_at: string;
}

interface ApiWebhookDelivery {
  id: string;
  webhook_id: string;
  event_id: string;
  event_type?: string;
  status: string;
  attempts: number;
  response_code: number | null;
  response_body: string | null;
  response_time_ms: number | null;
  created_at: string;
  completed_at: string | null;
}

interface ListWebhooksApiResponse {
  webhooks: ApiWebhook[];
  total: number;
}

interface CreateWebhookApiResponse {
  webhook: ApiWebhook;
  secret: string;
}

interface WebhookDeliveriesApiResponse {
  deliveries: ApiWebhookDelivery[];
  total: number;
  has_more: boolean;
  next_cursor?: string;
}

interface WebhookStatsApiResponse {
  total: number;
  success: number;
  failed: number;
  pending: number;
  success_rate: number;
  average_response_time_ms: number;
  time_range: string;
}

function transformWebhook(data: ApiWebhook): Webhook {
  return {
    id: data.id,
    tenantId: data.tenant_id,
    name: data.name,
    url: data.url,
    events: data.events,
    channelId: data.channel_id,
    headers: data.headers,
    status: data.status as Webhook['status'],
    retryConfig: {
      enabled: data.retry_config?.enabled,
      maxAttempts: data.retry_config?.max_attempts,
      backoff: data.retry_config?.backoff as 'linear' | 'exponential',
    },
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function transformDelivery(data: ApiWebhookDelivery): WebhookDelivery {
  return {
    id: data.id,
    webhookId: data.webhook_id,
    eventId: data.event_id,
    eventType: data.event_type,
    status: data.status as WebhookDelivery['status'],
    attempts: data.attempts,
    responseCode: data.response_code,
    responseBody: data.response_body,
    responseTimeMs: data.response_time_ms,
    createdAt: data.created_at,
    completedAt: data.completed_at,
  };
}

export class WebhooksResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List all webhooks
   */
  async list(): Promise<PaginatedResponse<Webhook>> {
    const response = await this.http.get<ListWebhooksApiResponse>('/v1/webhooks');
    return {
      data: response.webhooks.map(transformWebhook),
      total: response.total,
      hasMore: false,
    };
  }

  /**
   * Get a webhook by ID
   */
  async get(webhookId: string): Promise<Webhook> {
    const response = await this.http.get<{ webhook: ApiWebhook }>(`/v1/webhooks/${webhookId}`);
    return transformWebhook(response.webhook);
  }

  /**
   * Create a new webhook
   * @returns The created webhook and the signing secret (only returned once)
   */
  async create(params: CreateWebhookParams): Promise<{ webhook: Webhook; secret: string }> {
    const response = await this.http.post<CreateWebhookApiResponse>('/v1/webhooks', {
      name: params.name,
      url: params.url,
      events: params.events,
      channel_id: params.channelId,
      headers: params.headers,
      retry_config: params.retryConfig ? {
        enabled: params.retryConfig.enabled ?? true,
        max_attempts: params.retryConfig.maxAttempts ?? 5,
        backoff: params.retryConfig.backoff ?? 'exponential',
      } : undefined,
    });
    return {
      webhook: transformWebhook(response.webhook),
      secret: response.secret,
    };
  }

  /**
   * Update a webhook
   */
  async update(webhookId: string, params: UpdateWebhookParams): Promise<Webhook> {
    const response = await this.http.patch<{ webhook: ApiWebhook }>(`/v1/webhooks/${webhookId}`, {
      name: params.name,
      url: params.url,
      events: params.events,
      channel_id: params.channelId,
      headers: params.headers,
      status: params.status,
      retry_config: params.retryConfig ? {
        enabled: params.retryConfig.enabled,
        max_attempts: params.retryConfig.maxAttempts,
        backoff: params.retryConfig.backoff,
      } : undefined,
    });
    return transformWebhook(response.webhook);
  }

  /**
   * Delete a webhook
   */
  async delete(webhookId: string): Promise<void> {
    await this.http.delete(`/v1/webhooks/${webhookId}`);
  }

  /**
   * Regenerate webhook signing secret
   * @returns The new signing secret (only returned once)
   */
  async regenerateSecret(webhookId: string): Promise<{ webhook: Webhook; secret: string }> {
    const response = await this.http.post<CreateWebhookApiResponse>(
      `/v1/webhooks/${webhookId}/regenerate-secret`
    );
    return {
      webhook: transformWebhook(response.webhook),
      secret: response.secret,
    };
  }

  /**
   * List delivery history for a webhook
   */
  async deliveries(
    webhookId: string,
    options: { limit?: number; cursor?: string } = {}
  ): Promise<PaginatedResponse<WebhookDelivery> & { nextCursor?: string }> {
    const response = await this.http.get<WebhookDeliveriesApiResponse>(
      `/v1/webhooks/${webhookId}/deliveries`,
      {
        limit: options.limit || 50,
        cursor: options.cursor,
      }
    );
    return {
      data: response.deliveries.map(transformDelivery),
      total: response.total,
      hasMore: response.has_more,
      nextCursor: response.next_cursor,
    };
  }

  /**
   * Get webhook delivery statistics
   */
  async stats(
    webhookId: string,
    options: { timeRange?: '1h' | '24h' | '7d' } = {}
  ): Promise<WebhookStats> {
    const response = await this.http.get<WebhookStatsApiResponse>(
      `/v1/webhooks/${webhookId}/stats`,
      {
        time_range: options.timeRange || '24h',
      }
    );
    return {
      total: response.total,
      success: response.success,
      failed: response.failed,
      pending: response.pending,
      successRate: response.success_rate,
      averageResponseTimeMs: response.average_response_time_ms,
      timeRange: response.time_range as WebhookStats['timeRange'],
    };
  }
}
