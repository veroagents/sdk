/**
 * Realtime Resource
 *
 * WebSocket-based real-time event subscription for the VeroAI SDK.
 * Supports subscribing to channels, event types, or all events.
 */

import type {
  ConnectionState,
  EventHandler,
  StateChangeHandler,
  ErrorHandler,
  RealtimeConfig,
  RealtimeEvent,
  SubscribeOptions,
  SubscriptionCommand,
  SubscriptionConfirmation,
  TokenFetcher,
} from './types';
import type {
  LiveStateDiff,
  LiveStateDiffHandler,
  LiveStateSnapshot,
  LiveStateSnapshotHandler,
  LiveStateSubscriptionAck,
  LiveStateSubscriptionCommand,
} from './live-state-types';

const DEFAULT_REALTIME_URL = 'wss://ws.veroagents.com/events';
const DEFAULT_RECONNECT_INTERVAL = 1000;
const MAX_RECONNECT_INTERVAL = 30000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
const DEFAULT_HEARTBEAT_INTERVAL = 30000;

// Declare global types for cross-environment compatibility
declare const window: { WebSocket?: typeof WebSocket } | undefined;

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.WebSocket !== 'undefined';
}

/**
 * Get WebSocket implementation
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getWebSocket(): Promise<any> {
  if (isBrowser()) {
    return window!.WebSocket;
  }
  // Node.js environment - dynamically import ws package
  try {
    const ws = await import('ws');
    return ws.default || ws;
  } catch {
    throw new Error(
      'WebSocket is not available. In Node.js, install the "ws" package: npm install ws'
    );
  }
}

export class RealtimeResource {
  private readonly config: Required<RealtimeConfig>;
  private readonly tokenFetcher: TokenFetcher;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ws: any = null;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  // Event handlers
  private eventHandlers: Set<EventHandler> = new Set();
  private stateHandlers: Set<StateChangeHandler> = new Set();
  private errorHandlers: Set<ErrorHandler> = new Set();

  // Live-state handlers
  private liveStateSnapshotHandlers: Set<LiveStateSnapshotHandler> = new Set();
  private liveStateDiffHandlers: Set<LiveStateDiffHandler> = new Set();

  // Active subscriptions for reconnection
  private activeSubscriptions: {
    eventTypes: Set<string>;
    channels: Set<string>;
    subscribedToAll: boolean;
    tenantIds: Set<string>;
  } = {
    eventTypes: new Set(),
    channels: new Set(),
    subscribedToAll: false,
    tenantIds: new Set(),
  };

  // Pending subscription confirmations
  private pendingSubscriptions: Map<
    string,
    { resolve: (confirmation: SubscriptionConfirmation) => void; reject: (error: Error) => void }
  > = new Map();

  // Pending live-state subscribes. The promise resolves when the *snapshot*
  // frame lands (the ack arrives first but only signals authorization);
  // a `subscription_error` ack short-circuits the promise with a reject.
  private pendingLiveStateSubscribes: Map<
    string,
    {
      resolve: (snapshot: LiveStateSnapshot) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  > = new Map();

  // Pending live-state unsubscribes. Server replies with a
  // `subscription_confirmed` ack scoped to `live_state` + action=unsubscribe.
  private pendingLiveStateUnsubscribes: Map<
    string,
    {
      resolve: () => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  > = new Map();

  // Last snapshot per tenant — answered when the same tenant subscribes
  // twice (server is idempotent and won't resend the snapshot).
  private lastLiveStateSnapshot: Map<string, LiveStateSnapshot> = new Map();

  constructor(tokenFetcher: TokenFetcher, config?: RealtimeConfig) {
    this.tokenFetcher = tokenFetcher;
    this.config = {
      url: config?.url ?? DEFAULT_REALTIME_URL,
      autoReconnect: config?.autoReconnect ?? true,
      reconnectInterval: config?.reconnectInterval ?? DEFAULT_RECONNECT_INTERVAL,
      maxReconnectAttempts: config?.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS,
      heartbeatInterval: config?.heartbeatInterval ?? DEFAULT_HEARTBEAT_INTERVAL,
    };
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }

    this.setState('connecting');

    return new Promise(async (resolve, reject) => {
      try {
        // Get a short-lived WebSocket token from the API
        const token = await this.tokenFetcher();

        const WS = await getWebSocket();
        const url = new URL(this.config.url);
        url.searchParams.set('token', token);

        this.ws = new WS(url.toString());

        this.ws.onopen = () => {
          this.setState('connected');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.resubscribe();
          resolve();
        };

        this.ws.onclose = (event: { reason?: string }) => {
          this.stopHeartbeat();
          this.ws = null;

          if (this.state === 'connecting') {
            reject(new Error(`Connection failed: ${event.reason || 'Unknown reason'}`));
            this.setState('disconnected');
            return;
          }

          this.setState('disconnected');

          if (this.config.autoReconnect && this.shouldReconnect()) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (event: { message?: string }) => {
          const error = new Error(
            'WebSocket error' + (event.message ? `: ${event.message}` : '')
          );
          this.emitError(error);

          if (this.state === 'connecting') {
            reject(error);
          }
        };

        this.ws.onmessage = (event: { data: string | Buffer }) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        this.setState('disconnected');
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.config.autoReconnect = false;
    this.clearReconnectTimeout();
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.setState('disconnected');
  }

  /**
   * Subscribe to all events for the tenant
   */
  async subscribeAll(): Promise<SubscriptionConfirmation> {
    this.activeSubscriptions.subscribedToAll = true;
    return this.sendSubscription({
      type: 'subscribe',
      subscriptionType: 'all',
    });
  }

  /**
   * Unsubscribe from all events
   */
  async unsubscribeAll(): Promise<SubscriptionConfirmation> {
    this.activeSubscriptions.subscribedToAll = false;
    return this.sendSubscription({
      type: 'unsubscribe',
      subscriptionType: 'all',
    });
  }

  /**
   * Subscribe to specific channels
   */
  async subscribeChannels(channelIds: string[]): Promise<SubscriptionConfirmation> {
    for (const id of channelIds) {
      this.activeSubscriptions.channels.add(id);
    }
    return this.sendSubscription({
      type: 'subscribe',
      subscriptionType: 'channel',
      channels: channelIds,
    });
  }

  /**
   * Unsubscribe from specific channels
   */
  async unsubscribeChannels(channelIds: string[]): Promise<SubscriptionConfirmation> {
    for (const id of channelIds) {
      this.activeSubscriptions.channels.delete(id);
    }
    return this.sendSubscription({
      type: 'unsubscribe',
      subscriptionType: 'channel',
      channels: channelIds,
    });
  }

  /**
   * Subscribe to specific event types
   */
  async subscribeEventTypes(eventTypes: string[]): Promise<SubscriptionConfirmation> {
    for (const type of eventTypes) {
      this.activeSubscriptions.eventTypes.add(type);
    }
    return this.sendSubscription({
      type: 'subscribe',
      subscriptionType: 'event_type',
      eventTypes,
    });
  }

  /**
   * Unsubscribe from specific event types
   */
  async unsubscribeEventTypes(eventTypes: string[]): Promise<SubscriptionConfirmation> {
    for (const type of eventTypes) {
      this.activeSubscriptions.eventTypes.delete(type);
    }
    return this.sendSubscription({
      type: 'unsubscribe',
      subscriptionType: 'event_type',
      eventTypes,
    });
  }

  /**
   * Subscribe to channels and/or event types
   */
  async subscribe(options: SubscribeOptions): Promise<void> {
    const promises: Promise<SubscriptionConfirmation>[] = [];

    if (options.channels?.length) {
      promises.push(this.subscribeChannels(options.channels));
    }

    if (options.eventTypes?.length) {
      promises.push(this.subscribeEventTypes(options.eventTypes));
    }

    if (promises.length === 0) {
      throw new Error('Must specify at least one channel or event type');
    }

    await Promise.all(promises);
  }

  /**
   * Unsubscribe from channels and/or event types
   */
  async unsubscribe(options: SubscribeOptions): Promise<void> {
    const promises: Promise<SubscriptionConfirmation>[] = [];

    if (options.channels?.length) {
      promises.push(this.unsubscribeChannels(options.channels));
    }

    if (options.eventTypes?.length) {
      promises.push(this.unsubscribeEventTypes(options.eventTypes));
    }

    await Promise.all(promises);
  }

  /**
   * Subscribe to live tenant state (extensions + queues).
   *
   * Wire order on the server is `subscription_confirmed` → `snapshot` →
   * diffs. The returned promise resolves with the **snapshot** (not the
   * ack) — the ack is informational and only signals that the tenant is
   * authorised.
   *
   * Idempotency: if this client is already subscribed to the tenant the
   * server sends only an ack — no snapshot follows. We short-circuit
   * locally by returning the cached last snapshot if one exists.
   */
  async subscribeLiveState(tenantId: string): Promise<LiveStateSnapshot> {
    if (this.activeSubscriptions.tenantIds.has(tenantId)) {
      const cached = this.lastLiveStateSnapshot.get(tenantId);
      if (cached) {
        return cached;
      }
      // Edge case: tracked as active but no snapshot ever landed (e.g. a
      // crashed reconnect mid-snapshot). Fall through to a fresh send so
      // we wait for a real frame instead of resolving with nothing.
    }

    if (!this.ws || this.state !== 'connected') {
      throw new Error('Not connected');
    }

    this.activeSubscriptions.tenantIds.add(tenantId);

    return new Promise<LiveStateSnapshot>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingLiveStateSubscribes.delete(tenantId);
        reject(new Error('Live-state subscription timeout'));
      }, 10000);

      this.pendingLiveStateSubscribes.set(tenantId, {
        resolve: (snapshot) => {
          clearTimeout(timeout);
          resolve(snapshot);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout,
      });

      const command: LiveStateSubscriptionCommand = {
        action: 'subscribe',
        type: 'live_state',
        tenant_id: tenantId,
      };
      try {
        this.ws!.send(JSON.stringify(command));
      } catch (err) {
        clearTimeout(timeout);
        this.pendingLiveStateSubscribes.delete(tenantId);
        this.activeSubscriptions.tenantIds.delete(tenantId);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  /**
   * Unsubscribe a tenant's live state. Resolves on `subscription_confirmed`.
   * Idempotent: if the tenant isn't in our active set we still send the
   * frame to release any stale server-side state, but we don't await an
   * ack because the server treats unknown unsubscribes as confirmed
   * acks too.
   */
  async unsubscribeLiveState(tenantId: string): Promise<void> {
    this.activeSubscriptions.tenantIds.delete(tenantId);
    this.lastLiveStateSnapshot.delete(tenantId);

    if (!this.ws || this.state !== 'connected') {
      // Not connected — server has no per-client state to release; treat
      // as a no-op so callers can safely call this during teardown.
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingLiveStateUnsubscribes.delete(tenantId);
        reject(new Error('Live-state unsubscribe timeout'));
      }, 10000);

      this.pendingLiveStateUnsubscribes.set(tenantId, {
        resolve: () => {
          clearTimeout(timeout);
          resolve();
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout,
      });

      const command: LiveStateSubscriptionCommand = {
        action: 'unsubscribe',
        type: 'live_state',
        tenant_id: tenantId,
      };
      try {
        this.ws!.send(JSON.stringify(command));
      } catch (err) {
        clearTimeout(timeout);
        this.pendingLiveStateUnsubscribes.delete(tenantId);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  /**
   * Register a snapshot handler — called for the initial snapshot and any
   * subsequent reconciliation snapshots. Returns an unregister function.
   */
  onLiveStateSnapshot(handler: LiveStateSnapshotHandler): () => void {
    this.liveStateSnapshotHandlers.add(handler);
    return () => this.liveStateSnapshotHandlers.delete(handler);
  }

  /**
   * Register a diff handler — called for every ext/queue diff frame.
   * Returns an unregister function.
   */
  onLiveStateDiff(handler: LiveStateDiffHandler): () => void {
    this.liveStateDiffHandlers.add(handler);
    return () => this.liveStateDiffHandlers.delete(handler);
  }

  /**
   * Tenants this client currently has live_state subscriptions for.
   * Read-only snapshot — mutating the returned array does not affect SDK
   * state.
   */
  getLiveStateTenants(): string[] {
    return Array.from(this.activeSubscriptions.tenantIds);
  }

  /**
   * Add event handler
   */
  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Add connection state change handler
   */
  onStateChange(handler: StateChangeHandler): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  /**
   * Add error handler
   */
  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  /**
   * Remove all handlers
   */
  removeAllHandlers(): void {
    this.eventHandlers.clear();
    this.stateHandlers.clear();
    this.errorHandlers.clear();
    this.liveStateSnapshotHandlers.clear();
    this.liveStateDiffHandlers.clear();
  }

  // Private methods

  private setState(state: ConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    for (const handler of this.stateHandlers) {
      try {
        handler(state);
      } catch (error) {
        console.error('State handler error:', error);
      }
    }
  }

  private emitError(error: Error): void {
    for (const handler of this.errorHandlers) {
      try {
        handler(error);
      } catch (e) {
        console.error('Error handler error:', e);
      }
    }
  }

  private emitEvent(event: RealtimeEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Event handler error:', error);
      }
    }
  }

  private handleLiveStateAck(ack: LiveStateSubscriptionAck): void {
    const tenantId = ack.tenant_id;
    if (ack.action === 'unsubscribe') {
      const pending = this.pendingLiveStateUnsubscribes.get(tenantId);
      if (!pending) return;
      this.pendingLiveStateUnsubscribes.delete(tenantId);
      if (ack.type === 'subscription_error') {
        pending.reject(new Error(ack.error || 'Live-state unsubscribe failed'));
      } else {
        pending.resolve();
      }
      return;
    }

    // action === 'subscribe'
    if (ack.type === 'subscription_error') {
      const pending = this.pendingLiveStateSubscribes.get(tenantId);
      if (pending) {
        this.pendingLiveStateSubscribes.delete(tenantId);
        this.activeSubscriptions.tenantIds.delete(tenantId);
        pending.reject(new Error(ack.error || 'Live-state subscribe failed'));
      }
      return;
    }
    // subscription_confirmed for a successful subscribe — wait for the
    // snapshot before resolving the caller's promise.
  }

  private handleLiveStateSnapshot(snapshot: LiveStateSnapshot): void {
    this.lastLiveStateSnapshot.set(snapshot.tenant_id, snapshot);

    const pending = this.pendingLiveStateSubscribes.get(snapshot.tenant_id);
    if (pending) {
      this.pendingLiveStateSubscribes.delete(snapshot.tenant_id);
      pending.resolve(snapshot);
    }

    for (const handler of this.liveStateSnapshotHandlers) {
      try {
        handler(snapshot);
      } catch (error) {
        console.error('Live-state snapshot handler error:', error);
      }
    }
  }

  private handleLiveStateDiff(diff: LiveStateDiff): void {
    for (const handler of this.liveStateDiffHandlers) {
      try {
        handler(diff);
      } catch (error) {
        console.error('Live-state diff handler error:', error);
      }
    }
  }

  private handleMessage(data: string | Buffer): void {
    try {
      const message = JSON.parse(typeof data === 'string' ? data : data.toString());

      // Handle connection confirmation
      if (message.type === 'connected') {
        // Server sends: { type: 'connected', clientId, tenantId, message }
        // Connection already established, just log/ignore
        return;
      }

      // Handle subscription confirmations
      if (message.type === 'subscription_confirmed' || message.type === 'subscription_error') {
        // Live-state acks are discriminated by scope === 'live_state' +
        // tenant_id (rather than the channel/event_type `subscriptionType`).
        if (message.scope === 'live_state' && typeof message.tenant_id === 'string') {
          this.handleLiveStateAck(message as LiveStateSubscriptionAck);
          return;
        }

        const confirmation = message as SubscriptionConfirmation;
        const key = this.getSubscriptionKey(confirmation);
        const pending = this.pendingSubscriptions.get(key);
        if (pending) {
          this.pendingSubscriptions.delete(key);
          if (confirmation.type === 'subscription_error') {
            pending.reject(new Error(confirmation.error || 'Subscription failed'));
          } else {
            pending.resolve(confirmation);
          }
        }
        return;
      }

      // Live-state snapshot frame.
      if (
        message.type === 'snapshot' &&
        message.scope === 'live_state' &&
        typeof message.tenant_id === 'string'
      ) {
        const snapshot = message as LiveStateSnapshot;
        this.handleLiveStateSnapshot(snapshot);
        return;
      }

      // Live-state diff frame — scope discriminates ext vs queue.
      if (
        message.type === 'diff' &&
        (message.scope === 'ext' || message.scope === 'queue') &&
        typeof message.tenant_id === 'string'
      ) {
        this.handleLiveStateDiff(message as LiveStateDiff);
        return;
      }

      // Handle events - server wraps events as: { type: 'event', data: {...}, metadata: {...} }
      if (message.type === 'event' && message.data) {
        const eventData = message.data;
        // Transform snake_case to camelCase
        const event: RealtimeEvent = {
          id: eventData.id,
          tenantId: eventData.tenant_id || eventData.tenantId,
          channelId: eventData.channel_id || eventData.channelId,
          canonicalType: eventData.canonical_type || eventData.canonicalType,
          eventType: eventData.event_type || eventData.eventType,
          direction: eventData.direction,
          payload: eventData.payload,
          enrichment: eventData.enrichment,
          timestamp: eventData.timestamp,
          processedAt: eventData.processed_at || eventData.processedAt,
        };
        this.emitEvent(event);
      }
    } catch (error) {
      this.emitError(new Error(`Failed to parse message: ${error}`));
    }
  }

  private async sendSubscription(command: SubscriptionCommand): Promise<SubscriptionConfirmation> {
    if (!this.ws || this.state !== 'connected') {
      throw new Error('Not connected');
    }

    return new Promise((resolve, reject) => {
      const key = this.getSubscriptionKey({
        action: command.type,
        subscriptionType: command.subscriptionType,
      });

      // Set timeout for response
      const timeout = setTimeout(() => {
        this.pendingSubscriptions.delete(key);
        reject(new Error('Subscription timeout'));
      }, 10000);

      this.pendingSubscriptions.set(key, {
        resolve: (confirmation) => {
          clearTimeout(timeout);
          resolve(confirmation);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.ws!.send(JSON.stringify(command));
    });
  }

  private getSubscriptionKey(confirmation: Pick<SubscriptionConfirmation, 'action' | 'subscriptionType'>): string {
    return `${confirmation.action}:${confirmation.subscriptionType}`;
  }

  private shouldReconnect(): boolean {
    if (this.config.maxReconnectAttempts === 0) {
      return true; // Infinite reconnection
    }
    return this.reconnectAttempts < this.config.maxReconnectAttempts;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;

    this.setState('reconnecting');
    this.reconnectAttempts++;

    // Exponential backoff
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      MAX_RECONNECT_INTERVAL
    );

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null;
      try {
        await this.connect();
      } catch {
        // Error already handled in connect()
      }
    }, delay);
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private async resubscribe(): Promise<void> {
    // Re-establish subscriptions after reconnection. Live_state tenant
    // subscriptions need to be re-sent because the server keeps per-socket
    // state and the prior socket is now gone — we keep the local tracker
    // but the server's tenant-cleanup map dropped on disconnect.
    try {
      if (this.activeSubscriptions.subscribedToAll) {
        await this.subscribeAll();
      }

      if (this.activeSubscriptions.channels.size > 0) {
        await this.subscribeChannels(Array.from(this.activeSubscriptions.channels));
      }

      if (this.activeSubscriptions.eventTypes.size > 0) {
        await this.subscribeEventTypes(Array.from(this.activeSubscriptions.eventTypes));
      }

      const tenantIds = Array.from(this.activeSubscriptions.tenantIds);
      if (tenantIds.length > 0) {
        // Clear local tracking so subscribeLiveState() doesn't short-circuit
        // on the cached snapshot. We immediately re-add inside the method
        // so the active set reflects an in-flight subscribe.
        this.activeSubscriptions.tenantIds.clear();
        // Fire-and-forget per tenant with isolated error handling — one
        // tenant's failure must not block the others.
        await Promise.all(
          tenantIds.map((tenantId) =>
            this.subscribeLiveState(tenantId).catch((err) => {
              this.emitError(
                new Error(
                  `Failed to resubscribe live_state for tenant ${tenantId}: ${err instanceof Error ? err.message : String(err)}`
                )
              );
            })
          )
        );
      }
    } catch (error) {
      this.emitError(new Error(`Failed to resubscribe: ${error}`));
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.state === 'connected') {
        // Send ping frame (for ws library in Node.js)
        if (typeof (this.ws as unknown as { ping?: () => void }).ping === 'function') {
          (this.ws as unknown as { ping: () => void }).ping();
        }
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

/**
 * Factory function to create a realtime resource
 */
export function createRealtimeResource(tokenFetcher: TokenFetcher, config?: RealtimeConfig): RealtimeResource {
  return new RealtimeResource(tokenFetcher, config);
}
