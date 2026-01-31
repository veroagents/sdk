/**
 * VeroAI SDK Client
 *
 * The main entry point for interacting with the VeroAI API.
 *
 * @example
 * ```typescript
 * import { VeroAI } from '@veroai/sdk';
 *
 * const veroai = new VeroAI({ apiKey: 'sk_live_...' });
 *
 * // List channels
 * const { data: channels } = await veroai.channels.list();
 *
 * // Send a message
 * const result = await veroai.messages.send({
 *   channelId: 'ch_abc123',
 *   to: '+15551234567',
 *   content: { type: 'text', text: 'Hello from VeroAI!' }
 * });
 *
 * // Query events
 * const { data: events } = await veroai.events.list({
 *   channelId: 'ch_abc123',
 *   startDate: new Date('2024-01-01'),
 * });
 * ```
 */

import type { VeroAIConfig } from './types';
import { HttpClient } from './utils/http';
import {
  ChannelsResource,
  EventsResource,
  MessagesResource,
  WebhooksResource,
  ApiKeysResource,
  DomainsResource,
  VoiceResource,
} from './resources';
import { AgentsResource } from './resources/agents';
import { RealtimeResource } from './realtime';
import type { RealtimeConfig } from './realtime';

export class VeroAI {
  private readonly http: HttpClient;

  /** Manage communication channels (email, SMS, WhatsApp, etc.) */
  readonly channels: ChannelsResource;

  /** Query activity events and analytics */
  readonly events: EventsResource;

  /** Send messages through channels */
  readonly messages: MessagesResource;

  /** Manage webhook endpoints for real-time notifications */
  readonly webhooks: WebhooksResource;

  /** Manage API keys for authentication */
  readonly apiKeys: ApiKeysResource;

  /** Manage email domains for sending */
  readonly domains: DomainsResource;

  /** Voice phone numbers and call management */
  readonly voice: VoiceResource;

  /** AI agent configurations */
  readonly agents: AgentsResource;

  /** Real-time event subscriptions via WebSocket */
  readonly realtime: RealtimeResource;

  /**
   * Create a new VeroAI client instance
   *
   * @param config - Configuration options
   * @param config.apiKey - Your API key (required)
   * @param config.baseUrl - Custom API base URL (optional)
   * @param config.timeout - Request timeout in ms (default: 30000)
   * @param config.maxRetries - Max retry attempts (default: 3)
   * @param config.realtime - Realtime WebSocket configuration
   *
   * @example
   * ```typescript
   * // Basic usage
   * const veroai = new VeroAI({ apiKey: 'sk_live_...' });
   *
   * // With custom options
   * const veroai = new VeroAI({
   *   apiKey: 'sk_test_...',
   *   baseUrl: 'https://api.staging.veroai.dev',
   *   timeout: 60000,
   *   maxRetries: 5,
   * });
   * ```
   */
  constructor(config: VeroAIConfig & { realtime?: RealtimeConfig }) {
    this.http = new HttpClient(config);

    this.channels = new ChannelsResource(this.http);
    this.events = new EventsResource(this.http);
    this.messages = new MessagesResource(this.http);
    this.webhooks = new WebhooksResource(this.http);
    this.apiKeys = new ApiKeysResource(this.http);
    this.domains = new DomainsResource(this.http);
    this.voice = new VoiceResource(this.http);
    this.agents = new AgentsResource(this.http);

    // Create token fetcher for realtime - exchanges API key for short-lived WebSocket JWT
    const tokenFetcher = async (): Promise<string> => {
      const response = await this.http.post<{ token: string }>('/v1/realtime/auth', {});
      return response.token;
    };
    this.realtime = new RealtimeResource(tokenFetcher, config.realtime);
  }

  /**
   * Create a client from environment variables
   *
   * Looks for VEROAI_API_KEY environment variable
   *
   * @example
   * ```typescript
   * // Reads VEROAI_API_KEY from environment
   * const veroai = VeroAI.fromEnv();
   * ```
   */
  static fromEnv(overrides?: Partial<VeroAIConfig & { realtime?: RealtimeConfig }>): VeroAI {
    const apiKey = process.env.VEROAI_API_KEY;
    if (!apiKey) {
      throw new Error('VEROAI_API_KEY environment variable is not set');
    }

    return new VeroAI({
      apiKey,
      baseUrl: process.env.VEROAI_BASE_URL,
      ...overrides,
    });
  }
}
