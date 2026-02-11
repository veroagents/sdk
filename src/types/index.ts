/**
 * VeroAI SDK Types
 */

// ============================================================================
// Configuration
// ============================================================================

export interface VeroAIConfig {
  /** API key (sk_live_*, sk_test_*, or sk_dev_*) */
  apiKey: string;
  /** Base URL for API requests (default: https://api.veroai.dev) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Maximum number of retries for failed requests (default: 3) */
  maxRetries?: number;
  /** Custom fetch implementation (for Node.js < 18 or testing) */
  fetch?: typeof fetch;
}

// ============================================================================
// Common Types
// ============================================================================

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  hasMore: boolean;
  nextOffset?: number;
}

export interface DateRangeParams {
  startDate?: string | Date;
  endDate?: string | Date;
}

// ============================================================================
// Channels
// ============================================================================

export type AdapterType =
  | 'email_mx'
  | 'gmail-oauth'
  | 'sms_twilio'
  | 'whatsapp'
  | 'instagram'
  | 'messenger'
  | 'voice_twilio'
  | 'voice_jambonz'
  | 'vero-voice';

export type ChannelDirection = 'inbound' | 'outbound' | 'bidirectional';
export type ChannelStatus = 'pending' | 'active' | 'paused' | 'error' | 'suspended';

export interface Channel {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  adapterType: AdapterType;
  direction: ChannelDirection;
  status: ChannelStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChannelParams {
  name: string;
  description?: string;
  adapterType: AdapterType;
  direction: ChannelDirection;
  config: Record<string, unknown>;
}

export interface UpdateChannelParams {
  name?: string;
  description?: string;
  status?: 'active' | 'paused';
  config?: Record<string, unknown>;
}

export interface ChannelHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastEventAt: string | null;
  errorCount24h: number;
  successRate: number;
}

// ============================================================================
// Events
// ============================================================================

export type CanonicalType = 'message' | 'call' | 'status' | 'system' | 'ai';
export type EventDirection = 'inbound' | 'outbound' | 'internal';

export interface ActivityEvent {
  eventId: string;
  tenantId: string;
  channelId: string;
  eventType: string;
  canonicalType: CanonicalType;
  direction: EventDirection;
  adapterType: string;
  occurredAt: string;
  ingestedAt: string;
  payload: Record<string, unknown>;
}

export interface ListEventsParams extends PaginationParams, DateRangeParams {
  channelId?: string;
  eventType?: string;
  canonicalType?: CanonicalType;
  direction?: EventDirection;
}

export interface EventStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByChannel: Record<string, number>;
}

export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
}

export type TimeSeriesGranularity = 'minute' | 'hour' | 'day';

// ============================================================================
// Messages
// ============================================================================

export interface SendMessageParams {
  channelId: string;
  to: string | string[];
  subject?: string;
  content: {
    type: 'text' | 'html' | 'markdown';
    text?: string;
    html?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface SendMessageResult {
  messageId: string;
  eventId: string;
  status: 'queued' | 'sent';
  providerMessageId?: string;
}

// ============================================================================
// Webhooks
// ============================================================================

export type WebhookStatus = 'active' | 'paused' | 'suspended';

export interface RetryConfig {
  enabled: boolean;
  maxAttempts: number;
  backoff: 'linear' | 'exponential';
}

export interface Webhook {
  id: string;
  tenantId: string;
  name: string;
  url: string;
  events: string[];
  channelId: string | null;
  headers: Record<string, string>;
  status: WebhookStatus;
  retryConfig: RetryConfig;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWebhookParams {
  name: string;
  url: string;
  events: string[];
  channelId?: string | null;
  headers?: Record<string, string>;
  retryConfig?: Partial<RetryConfig>;
}

export interface UpdateWebhookParams {
  name?: string;
  url?: string;
  events?: string[];
  channelId?: string | null;
  headers?: Record<string, string>;
  status?: 'active' | 'paused';
  retryConfig?: Partial<RetryConfig>;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventId: string;
  eventType?: string;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  responseCode: number | null;
  responseBody: string | null;
  responseTimeMs: number | null;
  createdAt: string;
  completedAt: string | null;
}

export interface WebhookStats {
  total: number;
  success: number;
  failed: number;
  pending: number;
  successRate: number;
  averageResponseTimeMs: number;
  timeRange: '1h' | '24h' | '7d';
}

// ============================================================================
// API Keys
// ============================================================================

export type ApiKeyEnvironment = 'production' | 'development' | 'testing';

export interface ApiKey {
  id: string;
  tenantId: string;
  name: string;
  keyPrefix: string;
  environment: ApiKeyEnvironment;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface CreateApiKeyParams {
  name: string;
  environment: ApiKeyEnvironment;
  scopes: string[];
  expiresAt?: string | Date;
}

export interface CreateApiKeyResult {
  apiKey: ApiKey;
  /** The plaintext key - only returned once at creation */
  key: string;
}

// ============================================================================
// Domains
// ============================================================================

export type DomainStatus = 'pending' | 'verified' | 'failed';

export interface Domain {
  id: string;
  tenantId: string;
  domain: string;
  status: DomainStatus;
  verificationRecord: string | null;
  verificationStatus: {
    dkim: boolean;
    spf: boolean;
    dmarc: boolean;
    mx: boolean;
    lastCheckedAt?: string | null;
  };
  dnsRecords: DnsRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface DnsRecord {
  type: 'MX' | 'TXT' | 'CNAME';
  name: string;
  value: string;
  priority?: number;
  verified: boolean;
}

export interface CreateDomainParams {
  domain: string;
  verificationMethod: 'cloudflare' | 'manual';
  cloudflareApiToken?: string;
}

export interface VerifyDomainResult {
  domain: Domain;
  verificationResults: {
    dkim: { verified: boolean; error?: string };
    spf: { verified: boolean; error?: string };
    dmarc: { verified: boolean; error?: string };
    mx: { verified: boolean; error?: string };
  };
}

// ============================================================================
// Enrichment
// ============================================================================

export interface EnrichmentConfig {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'archived';
  intents: IntentDefinition[];
  entities: EntityDefinition[];
  sentiment: SentimentConfig;
  language: LanguageConfig;
  channelOverrides: Record<string, ChannelOverride>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface IntentDefinition {
  id: string;
  name: string;
  description: string;
  examples: string[];
  priority: number;
}

export interface EntityDefinition {
  id: string;
  name: string;
  type: 'custom' | 'builtin';
  extractionType: 'keyword' | 'pattern' | 'llm';
  values?: string[];
  pattern?: string;
}

export interface SentimentConfig {
  enabled: boolean;
  includeUrgency: boolean;
}

export interface LanguageConfig {
  enabled: boolean;
  supportedLanguages: string[];
  translateToEnglish: boolean;
}

export interface ChannelOverride {
  intents?: string[];
  entities?: string[];
  sentiment?: boolean;
  language?: boolean;
}

export interface EnrichmentResult {
  intent: string;
  intentConfidence: number;
  entities: ExtractedEntity[];
  sentiment?: {
    label: 'positive' | 'negative' | 'neutral';
    score: number;
  };
  language?: {
    detected: string;
    confidence: number;
  };
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  processedAt: string;
  modelVersion: string;
}

export interface ExtractedEntity {
  type: string;
  value: string;
  confidence: number;
  position?: { start: number; end: number };
}

// ============================================================================
// Voice - Phone Numbers
// ============================================================================

export type PhoneNumberStatus = 'active' | 'pending' | 'released';
export type PhoneNumberCapability = 'voice' | 'sms' | 'mms';

export interface PhoneNumber {
  id: string;
  number: string;
  country: string;
  region: string | null;
  locality: string | null;
  capabilities: PhoneNumberCapability[];
  channelId: string | null;
  channelName?: string | null;
  status: PhoneNumberStatus;
  monthlyCostCents: number | null;
  setupCostCents: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AvailableNumber {
  number: string;
  country: string;
  region: string | null;
  locality: string | null;
  capabilities: PhoneNumberCapability[];
  monthlyCostCents: number;
  setupCostCents: number;
  provider: string;
}

export interface SearchNumbersParams {
  country: string;
  areaCode?: string;
  contains?: string;
  capabilities?: PhoneNumberCapability[];
  limit?: number;
}

export interface PurchaseNumberParams {
  number: string;
  channelId?: string;
}

export interface UpdateNumberParams {
  channelId?: string | null;
}

export interface ListNumbersParams extends PaginationParams {
  channelId?: string;
  status?: PhoneNumberStatus;
  country?: string;
  capabilities?: PhoneNumberCapability[];
}

// ============================================================================
// Voice - Calls
// ============================================================================

export type CallDirection = 'inbound' | 'outbound';
export type CallStatus = 'initiated' | 'ringing' | 'answered' | 'ended';
export type CallEndReason = 'completed' | 'busy' | 'no-answer' | 'failed' | 'canceled';

export interface Call {
  id: string;
  channelId: string;
  providerCallSid: string;
  fromNumber: string;
  toNumber: string;
  direction: CallDirection;
  status: CallStatus;
  endReason: CallEndReason | null;
  initiatedAt: string;
  ringingAt: string | null;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  recordingUrl: string | null;
  transcriptionUrl: string | null;
  agentId: string | null;
  metadata: Record<string, unknown> | null;
}

export interface DialParams {
  channelId: string;
  to: string;
  from?: string;
  timeout?: number;
  metadata?: Record<string, unknown>;
}

export interface ListCallsParams extends PaginationParams, DateRangeParams {
  channelId?: string;
  direction?: CallDirection;
  status?: CallStatus;
  fromNumber?: string;
  toNumber?: string;
}

// ============================================================================
// Voice - Channel Configuration
// ============================================================================

export type InboundHandler = 'agent' | 'webhook' | 'forward' | 'voicemail';

export interface TtsConfig {
  vendor: 'elevenlabs' | 'google' | 'azure' | 'aws' | 'deepgram';
  voice: string;
  language?: string;
}

export interface SttConfig {
  vendor: 'deepgram' | 'google' | 'azure' | 'aws' | 'assembly';
  model: string;
  language: string;
}

export interface RecordingConfig {
  enabled: boolean;
  stereo: boolean;
}

export interface InboundConfig {
  forwardTo?: string;
  webhookUrl?: string;
  voicemailGreeting?: string;
  agentId?: string;
}

export interface VoiceChannelConfig {
  inboundHandler: InboundHandler;
  inboundConfig?: InboundConfig;
  tts?: TtsConfig;
  stt?: SttConfig;
  recording?: RecordingConfig;
  transcriptionEnabled?: boolean;
}

export interface CreateVoiceChannelParams {
  name: string;
  description?: string;
  config: VoiceChannelConfig;
}

export interface UpdateVoiceChannelParams {
  name?: string;
  description?: string;
  status?: 'active' | 'paused';
  config?: Partial<VoiceChannelConfig>;
}

// ============================================================================
// Voice - LiveKit Rooms (WebRTC)
// ============================================================================

export interface CreateRoomParams {
  /** Room name (unique identifier) */
  name: string;
  /** Optional custom room ID (defaults to generated UUID) */
  roomId?: string;
  /** Optional channel ID to associate with the room */
  channelId?: string;
  /** Optional agent config ID — when provided, the server fetches the full agent config and embeds it in room metadata */
  agentConfigId?: string;
  /** Time in seconds before empty room is deleted (default: 300) */
  emptyTimeout?: number;
  /** Maximum number of participants (default: 10) */
  maxParticipants?: number;
  /** Optional metadata to attach to the room */
  metadata?: Record<string, unknown>;
}

export interface JoinRoomParams {
  /** Name of the room to join */
  roomName: string;
  /** Display name for the participant */
  participantName: string;
  /** Unique identifier for the participant (defaults to participantName) */
  participantIdentity?: string;
  /** Whether participant can publish audio/video (default: true) */
  canPublish?: boolean;
  /** Whether participant can subscribe to others (default: true) */
  canSubscribe?: boolean;
  /** Whether participant can send data messages (default: true) */
  canPublishData?: boolean;
  /** Optional metadata to attach to the participant */
  metadata?: Record<string, unknown>;
}

export interface LiveKitRoomInfo {
  /** Server-assigned room ID */
  sid: string;
  /** Room name */
  name: string;
  /** WebSocket URL for client connection */
  wsUrl: string;
  /** Access token for joining the room */
  token: string;
  /** Current number of participants */
  numParticipants: number;
  /** Room metadata */
  metadata?: Record<string, unknown>;
}

export interface LiveKitRoom {
  /** Server-assigned room ID */
  sid: string;
  /** Room name */
  name: string;
  /** Time in seconds before empty room is deleted */
  emptyTimeout: number;
  /** Maximum number of participants */
  maxParticipants: number;
  /** Room creation timestamp */
  creationTime: string;
  /** Current number of participants */
  numParticipants: number;
  /** Room metadata */
  metadata?: string;
}

export type ParticipantState = 'JOINING' | 'ACTIVE' | 'DISCONNECTED';

export interface LiveKitParticipant {
  /** Server-assigned participant ID */
  sid: string;
  /** Participant identity */
  identity: string;
  /** Participant display name */
  name: string;
  /** Current connection state */
  state: ParticipantState;
  /** Participant metadata */
  metadata?: string;
  /** Timestamp when participant joined */
  joinedAt: string;
  /** Whether participant is publishing any tracks */
  isPublisher: boolean;
}

export interface ListRoomsParams {
  /** Filter by room names */
  names?: string[];
}

export interface ListParticipantsParams {
  /** Room name to list participants from */
  roomName: string;
}

// ============================================================================
// Voice - Real-Time Session (Jambonz WebSocket)
// ============================================================================

export type VoiceSessionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface VoiceSessionOptions {
  /** Channel ID for the session */
  channelId: string;
  /** Call SID to control */
  callSid: string;
  /** WebSocket URL for the voice adapter */
  wsUrl?: string;
}

export interface SayOptions {
  /** TTS voice to use */
  voice?: string;
  /** Language for TTS */
  language?: string;
  /** Speech rate (0.5 to 2.0) */
  rate?: number;
}

export interface GatherOptions {
  /** Maximum digits to collect */
  maxDigits?: number;
  /** Minimum digits to collect */
  minDigits?: number;
  /** Timeout in seconds for digit input */
  timeout?: number;
  /** Digits that finish gathering (e.g., '#') */
  finishOnKey?: string;
  /** Enable speech recognition */
  speech?: boolean;
  /** Language for speech recognition */
  speechLanguage?: string;
  /** Prompt to play before gathering */
  prompt?: string;
}

export interface GatherResult {
  /** DTMF digits collected */
  digits?: string;
  /** Speech transcription */
  speech?: string;
  /** Reason gathering ended */
  reason: 'digits' | 'speech' | 'timeout' | 'hangup';
}

export interface TransferOptions {
  /** Announcement to play before transfer */
  announcement?: string;
  /** Timeout for transfer attempt */
  timeout?: number;
  /** Caller ID to display */
  callerId?: string;
}

export interface RecordingOptions {
  /** Enable stereo recording */
  stereo?: boolean;
  /** Maximum recording duration in seconds */
  maxDuration?: number;
  /** Silence timeout to stop recording */
  silenceTimeout?: number;
}

export interface VoiceSessionEvents {
  /** Session connected */
  connected: () => void;
  /** Session disconnected */
  disconnected: (reason?: string) => void;
  /** Error occurred */
  error: (error: Error) => void;
  /** DTMF digit received */
  dtmf: (digit: string) => void;
  /** Speech detected */
  speech: (transcript: string, isFinal: boolean) => void;
  /** Audio data received */
  audio: (data: ArrayBuffer) => void;
  /** Call ended */
  callEnded: (reason: CallEndReason) => void;
}

// ============================================================================
// Voice - AI Agent Integration
// ============================================================================

export interface AgentConfig {
  /** Agent configuration ID */
  id: string;
  /** Agent name */
  name: string;
  /** Agent description */
  description: string | null;
  /** Whether agent is enabled */
  enabled: boolean;
  /** Model configuration */
  modelConfig: {
    provider: 'anthropic' | 'openai';
    modelId: string;
    temperature: number;
    maxTokens: number;
  };
  /** System prompt */
  systemPrompt: string;
  /** Status */
  status: 'draft' | 'active' | 'archived';
}

export interface ListAgentsParams extends PaginationParams {
  /** Filter by status */
  status?: 'draft' | 'active' | 'archived';
  /** Filter by enabled state */
  enabled?: boolean;
}

export interface CreateAgentParams {
  /** Agent name */
  name: string;
  /** Agent description */
  description?: string;
  /** Model configuration */
  modelConfig: {
    provider: 'anthropic' | 'openai';
    modelId: string;
    temperature?: number;
    maxTokens?: number;
  };
  /** System prompt */
  systemPrompt: string;
  /** Whether to enable immediately */
  enabled?: boolean;
}

export interface UpdateAgentParams {
  /** Agent name */
  name?: string;
  /** Agent description */
  description?: string;
  /** Model configuration */
  modelConfig?: {
    provider?: 'anthropic' | 'openai';
    modelId?: string;
    temperature?: number;
    maxTokens?: number;
  };
  /** System prompt */
  systemPrompt?: string;
  /** Whether agent is enabled */
  enabled?: boolean;
  /** Status */
  status?: 'draft' | 'active' | 'archived';
}

export interface AgentCallSession {
  /** Call SID */
  callSid: string;
  /** Channel ID */
  channelId: string;
  /** Agent ID handling the call */
  agentId: string;
  /** LiveKit room name */
  roomName: string;
  /** Caller phone number */
  callerNumber: string;
  /** Called phone number */
  calledNumber: string;
  /** Session start time */
  startedAt: string;
  /** Session status */
  status: 'connecting' | 'active' | 'ended';
}

export interface ListAgentCallsParams extends PaginationParams {
  /** Filter by agent ID */
  agentId?: string;
  /** Filter by channel ID */
  channelId?: string;
  /** Filter by status */
  status?: 'connecting' | 'active' | 'ended';
}

// ============================================================================
// Errors
// ============================================================================

export interface VeroAIErrorDetails {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
