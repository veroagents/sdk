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
  AttachmentsResource,
  MessagingResource,
} from './resources';
import { AccountsResource } from './resources/accounts';
import { AgentsResource } from './resources/agents';
import { BrainResource } from './resources/brain';
import { SandcastleResource } from './resources/sandcastle';
import { TeamsResource } from './resources/teams';
import { UsersResource } from './resources/users';
import { FederationResource } from './resources/federation';
import { RealtimeResource } from './realtime';
import type { RealtimeConfig } from './realtime';

const DEFAULT_AUTHSRV_URL = 'https://auth.veroagents.com';

export class VeroAI {
  private readonly http: HttpClient;
  private readonly config: VeroAIConfig & { realtime?: RealtimeConfig };

  /** Manage your account, tenants, and members (account-scoped API key required) */
  readonly accounts: AccountsResource;

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

  /** Attachment metadata and downloads */
  readonly attachments: AttachmentsResource;

  /** AI agent configurations, runs, and triggers */
  readonly agents: AgentsResource;

  /** Structured agent memory — facts, moments, relationships, tasks */
  readonly brain: BrainResource;

  /** Firecracker microVMs for isolated agent execution */
  readonly sandcastle: SandcastleResource;

  /** Agent teams */
  readonly teams: TeamsResource;

  /** Chat messaging WebSocket tokens */
  readonly messaging: MessagingResource;

  /** Authenticate end-users for your customer-tenant apps */
  readonly users: UsersResource;

  /**
   * Federation — mint scoped Vero end-user JWTs for the customer's own
   * end-users (FEDERATED.md). Requires `config.federation` to be set on
   * the constructor: at minimum `oauthClient: {id, secret}` for the
   * mint/revoke methods, OR `adminToken` for the key-registration
   * methods. Methods without the required config throw
   * `FederationConfigError`.
   */
  readonly federation: FederationResource;

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
   *   baseUrl: 'https://api.staging.veroagents.com',
   *   timeout: 60000,
   *   maxRetries: 5,
   * });
   * ```
   */
  constructor(config: VeroAIConfig & { realtime?: RealtimeConfig }) {
    this.config = config;
    this.http = new HttpClient(config);

    this.accounts = new AccountsResource(this.http);
    this.channels = new ChannelsResource(this.http);
    this.events = new EventsResource(this.http);
    this.messages = new MessagesResource(this.http);
    this.webhooks = new WebhooksResource(this.http);
    this.apiKeys = new ApiKeysResource(this.http);
    this.domains = new DomainsResource(this.http);
    this.voice = new VoiceResource(this.http);
    this.attachments = new AttachmentsResource(this.http);
    this.agents = new AgentsResource(this.http);
    this.brain = new BrainResource(this.http);
    this.sandcastle = new SandcastleResource(this.http);
    this.teams = new TeamsResource(this.http);
    this.messaging = new MessagingResource(this.http);
    this.users = new UsersResource(this.http);
    this.federation = new FederationResource({
      authsrvUrl: config.federation?.authsrvUrl ?? DEFAULT_AUTHSRV_URL,
      oauthClient: config.federation?.oauthClient,
      adminToken: config.federation?.adminToken,
      fetch: config.fetch,
    });

    // Create token fetcher for realtime - exchanges API key for short-lived WebSocket JWT
    const tokenFetcher = async (): Promise<string> => {
      const response = await this.http.post<{ token: string }>('/v1/realtime/auth', {});
      return response.token;
    };
    this.realtime = new RealtimeResource(tokenFetcher, config.realtime);
  }

  /**
   * Create a new client scoped to a specific tenant.
   *
   * Useful with account-scoped API keys when you need to operate
   * on a specific tenant's resources.
   *
   * @example
   * ```typescript
   * const veroai = new VeroAI({ apiKey: 'sk_live_...' }); // account-scoped
   * const tenantClient = veroai.forTenant('tenant-uuid');
   * const agents = await tenantClient.agents.list(); // scoped to that tenant
   * ```
   */
  forTenant(tenantId: string): VeroAI {
    return new VeroAI({ ...this.config, tenantId });
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
