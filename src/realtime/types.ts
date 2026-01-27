/**
 * Realtime Types
 *
 * Types for WebSocket real-time event subscriptions
 */

/**
 * Subscription type
 */
export type SubscriptionType = 'event_type' | 'channel' | 'all';

/**
 * Subscription options
 */
export interface SubscribeOptions {
  /** Subscribe to specific event types */
  eventTypes?: string[];
  /** Subscribe to specific channel IDs */
  channels?: string[];
}

/**
 * Realtime connection state
 */
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting';

/**
 * Subscription command sent to server
 * Matches WebSocket server protocol spec
 */
export interface SubscriptionCommand {
  type: 'subscribe' | 'unsubscribe';
  subscriptionType: SubscriptionType;
  eventTypes?: string[];
  channels?: string[];
}

/**
 * Subscription confirmation from server
 */
export interface SubscriptionConfirmation {
  type: 'subscription_confirmed' | 'subscription_error';
  /** The action that was confirmed (matches the 'type' field from the command) */
  action: 'subscribe' | 'unsubscribe';
  subscriptionType: SubscriptionType;
  items: string[];
  error?: string;
}

/**
 * Real-time event received from WebSocket
 */
export interface RealtimeEvent {
  /** Event ID */
  id: string;
  /** Tenant ID */
  tenantId: string;
  /** Channel ID */
  channelId: string;
  /** Canonical event type */
  canonicalType: string;
  /** Original event type from adapter */
  eventType: string;
  /** Event direction */
  direction: 'inbound' | 'outbound';
  /** Event payload */
  payload: Record<string, unknown>;
  /** Enrichment data (if available) */
  enrichment?: {
    intent?: {
      intent: string;
      confidence: number;
    };
    sentiment?: {
      sentiment: string;
      score: number;
    };
    language?: {
      code: string;
      confidence: number;
    };
    entities?: Array<{
      type: string;
      value: string;
      confidence: number;
    }>;
  };
  /** Event timestamp */
  timestamp: string;
  /** Processing timestamp */
  processedAt: string;
}

/**
 * Event handler function
 */
export type EventHandler = (event: RealtimeEvent) => void;

/**
 * Connection state change handler
 */
export type StateChangeHandler = (state: ConnectionState) => void;

/**
 * Error handler
 */
export type ErrorHandler = (error: Error) => void;

/**
 * Realtime configuration options
 */
export interface RealtimeConfig {
  /** WebSocket URL (default: wss://realtime.veroai.dev/ws) */
  url?: string;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Reconnect interval in ms (default: 1000, max: 30000) */
  reconnectInterval?: number;
  /** Max reconnection attempts (default: 10, 0 for infinite) */
  maxReconnectAttempts?: number;
  /** Heartbeat interval in ms (default: 30000) */
  heartbeatInterval?: number;
}

/**
 * Token fetcher function type
 * Used to get a short-lived WebSocket token from the API
 */
export type TokenFetcher = () => Promise<string>;
