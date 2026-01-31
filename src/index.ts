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

  // Voice - Phone Numbers
  PhoneNumberStatus,
  PhoneNumberCapability,
  PhoneNumber,
  AvailableNumber,
  SearchNumbersParams,
  PurchaseNumberParams,
  UpdateNumberParams,
  ListNumbersParams,

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

  // Chat
  ConversationType,
  MessageType,
  ParticipantRole,
  PresenceStatus,
  ChatUser,
  ChatUserWithPresence,
  ConversationParticipant,
  MessageRead,
  ChatMessage,
  Conversation,
  CreateConversationParams,
  SendChatMessageParams,
  ListMessagesParams,
  MessagesResponse,
  AddAgentParams,
  ConversationAgent,
  UserPresence,
  UpdatePresenceParams,
  ListUsersParams,

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

// Voice
export { VoiceResource, VoiceNumbersResource, VoiceCallsResource } from './resources';

// Chat
export { ChatResource, ConversationsResource, ChatUsersResource } from './resources';

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
