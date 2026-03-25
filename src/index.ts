/**
 * VeroAI SDK
 *
 * Official TypeScript/JavaScript SDK for VeroAI - Unified communications API
 *
 * @packageDocumentation
 */

// Main client
export { VeroAI } from './client';

// Types
export type {
  VeroAIConfig,
  PaginationParams,
  PaginatedResponse,
  DateRangeParams,

  // Channels
  AdapterType,
  ChannelDirection,
  ChannelStatus,
  Channel,
  CreateChannelParams,
  UpdateChannelParams,
  ChannelHealth,

  // Events
  CanonicalType,
  EventDirection,
  ActivityEvent,
  ListEventsParams,
  EventStats,
  TimeSeriesDataPoint,
  TimeSeriesGranularity,

  // Messages
  SendMessageParams,
  SendMessageResult,

  // Webhooks
  WebhookStatus,
  RetryConfig,
  Webhook,
  CreateWebhookParams,
  UpdateWebhookParams,
  WebhookDelivery,
  WebhookStats,

  // API Keys
  ApiKeyEnvironment,
  ApiKey,
  CreateApiKeyParams,
  CreateApiKeyResult,

  // Domains
  DomainStatus,
  Domain,
  DnsRecord,
  CreateDomainParams,
  VerifyDomainResult,

  // Enrichment
  EnrichmentConfig,
  IntentDefinition,
  EntityDefinition,
  SentimentConfig,
  LanguageConfig,
  ChannelOverride,
  EnrichmentResult,
  ExtractedEntity,

  // Voice - Applications
  VoiceApplication,
  CreateApplicationParams,
  UpdateApplicationParams,

  // Voice - Phone Numbers
  PhoneNumberStatus,
  PhoneNumberCapability,
  PhoneNumber,
  AvailableNumber,
  SearchNumbersParams,
  PurchaseNumberParams,
  AddNumberParams,
  UpdateNumberParams,
  ListNumbersParams,

  // Voice - Carriers
  CarrierTrunkType,
  CarrierStatus,
  VoiceCarrier,
  VoiceCarrierCreateParams,
  VoiceCarrierUpdateParams,
  ListCarriersParams,
  PredefinedCarrier,

  // Voice - Calls
  CallDirection,
  CallStatus,
  CallEndReason,
  Call,
  DialParams,
  ListCallsParams,

  // Voice - Channel Configuration
  InboundHandler,
  TtsConfig,
  SttConfig,
  RecordingConfig,
  InboundConfig,
  VoiceChannelConfig,
  CreateVoiceChannelParams,
  UpdateVoiceChannelParams,

  // Agents
  Agent,
  ListAgentsParams,
  CreateAgentParams,
  UpdateAgentParams,


  // Messaging
  MessagingToken,

  // Errors
  VeroAIErrorDetails,
} from './types';

// Errors
export {
  VeroAIError,
  APIError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  ServerError,
  TimeoutError,
  NetworkError,
} from './utils/errors';

// Resources
export { AgentsResource } from './resources/agents';
export { TeamsResource } from './resources/teams';
export { MessagingResource } from './resources/messaging';

// Voice
export { VoiceResource, VoiceNumbersResource, VoiceCallsResource, VoiceCarriersResource, VoiceApplicationsResource, VoiceAgentsResource, VoiceProvisioningResource } from './resources';

// Voice Agent Wiring types
export type {
  VoiceAgentStatus,
  VoiceAgentChannel,
  VoiceAgentNumber,
  WireAgentParams,
  WireAgentResult,
  UnwireAgentParams,
} from './resources/voice/agents';

// Voice Provisioning types
export type {
  JambonzProvisioningStatus,
  ProvisionJambonzResult,
} from './resources/voice/provisioning';

// Realtime
export { RealtimeResource, createRealtimeResource } from './realtime';
export type {
  ConnectionState,
  EventHandler,
  StateChangeHandler,
  ErrorHandler,
  RealtimeConfig,
  RealtimeEvent,
  SubscribeOptions,
  SubscriptionType,
} from './realtime';

// Default export for convenience
export { VeroAI as default } from './client';
