/**
 * Channels Resource
 */

import type { HttpClient } from '../utils/http';
import type {
  Channel,
  CreateChannelParams,
  UpdateChannelParams,
  ChannelHealth,
  PaginatedResponse,
} from '../types';

interface ApiChannel {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  adapter_type: string;
  direction: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ListChannelsApiResponse {
  channels: ApiChannel[];
  total: number;
}

interface CreateChannelApiResponse {
  channel: ApiChannel;
  oauth_url?: string;
}

interface ChannelHealthApiResponse {
  status: string;
  last_event_at: string | null;
  error_count_24h: number;
  success_rate: number;
}

function transformChannel(data: ApiChannel): Channel {
  return {
    id: data.id,
    tenantId: data.tenant_id,
    name: data.name,
    description: data.description,
    adapterType: data.adapter_type as Channel['adapterType'],
    direction: data.direction as Channel['direction'],
    status: data.status as Channel['status'],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export class ChannelsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List all channels
   */
  async list(): Promise<PaginatedResponse<Channel>> {
    const response = await this.http.get<ListChannelsApiResponse>('/v1/channels');
    return {
      data: response.channels.map(transformChannel),
      total: response.total,
      hasMore: false,
    };
  }

  /**
   * Get a channel by ID
   */
  async get(channelId: string): Promise<Channel> {
    const response = await this.http.get<{ channel: ApiChannel }>(`/v1/channels/${channelId}`);
    return transformChannel(response.channel);
  }

  /**
   * Create a new channel
   * @returns The created channel and optionally an OAuth URL for OAuth-based adapters
   */
  async create(params: CreateChannelParams): Promise<{ channel: Channel; oauthUrl?: string }> {
    const response = await this.http.post<CreateChannelApiResponse>('/v1/channels', {
      name: params.name,
      description: params.description,
      adapter_type: params.adapterType,
      direction: params.direction,
      config: params.config,
    });
    return {
      channel: transformChannel(response.channel),
      oauthUrl: response.oauth_url,
    };
  }

  /**
   * Update a channel
   */
  async update(channelId: string, params: UpdateChannelParams): Promise<Channel> {
    const response = await this.http.put<{ channel: ApiChannel }>(`/v1/channels/${channelId}`, {
      name: params.name,
      description: params.description,
      status: params.status,
      config: params.config,
    });
    return transformChannel(response.channel);
  }

  /**
   * Delete a channel
   */
  async delete(channelId: string): Promise<void> {
    await this.http.delete(`/v1/channels/${channelId}`);
  }

  /**
   * Test channel connectivity
   */
  async test(channelId: string): Promise<{ success: boolean; message?: string }> {
    return this.http.post<{ success: boolean; message?: string }>(`/v1/channels/${channelId}/test`);
  }

  /**
   * Get channel health metrics
   */
  async health(channelId: string): Promise<ChannelHealth> {
    const response = await this.http.get<ChannelHealthApiResponse>(`/v1/channels/${channelId}/health`);
    return {
      status: response.status as ChannelHealth['status'],
      lastEventAt: response.last_event_at,
      errorCount24h: response.error_count_24h,
      successRate: response.success_rate,
    };
  }
}
