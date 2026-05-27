/**
 * Live State Types
 *
 * Wire types for the `live_state` subscription scope. statesrv writes
 * canonical extension/queue state into Redis hashes and publishes diffs to
 * `channel:{tenant}:ext` and `channel:{tenant}:queue`; vero-websocket
 * forwards those frames verbatim to subscribed clients after sending an
 * initial snapshot frame.
 *
 * Wire frames use `snake_case` to match the Redis pubsub contract that
 * statesrv owns. We keep both shapes available:
 *   - `*Wire` types match the JSON exactly as it lands on the socket.
 *   - The UI-friendly `*UI` shapes live in `./mapping.ts` and are produced
 *     by transformer helpers; nothing in this file imports them.
 *
 * Source of truth:
 *   - statesrv SPEC.md lines 397-407 (diff publish format)
 *   - veroai/backend/consumers/websocket/live-state-types.ts (server mirror)
 *   - veroai/backend/consumers/websocket/live-state-manager.ts (ack frames)
 */

/**
 * Extension status — statesrv emits a string; we type the values we know
 * about and leave `string` as a fallthrough so an unknown future status
 * doesn't break the SDK at the type boundary.
 */
export type LiveStateExtensionStatus =
  | 'idle'
  | 'ringing'
  | 'on_call'
  | (string & {});

/**
 * Call direction on the wire. statesrv may emit `internal` for in-PBX
 * extension-to-extension calls; UI domain only models `inbound`/`outbound`
 * so the mapping helpers fold `internal` into `inbound`.
 */
export type LiveStateExtensionDirection =
  | 'inbound'
  | 'outbound'
  | 'internal'
  | (string & {});

/**
 * Per-extension wire shape (snapshot.extensions[i] + diff payload share
 * the same fields). statesrv stores numbers as decimal strings in Redis
 * but serialises them back to numbers in the published JSON.
 */
export interface LiveStateExtension {
  ext: string;
  status: LiveStateExtensionStatus;
  direction?: LiveStateExtensionDirection;
  peer?: string;
  peer_display?: string;
  call_id?: string;
  started_at_ms?: number;
  updated_at_ms?: number;
}

/**
 * Per-queue agent state on the wire.
 */
export type LiveStateAgentState =
  | 'available'
  | 'on_call'
  | 'paused'
  | 'wrap_up'
  | 'offline'
  | (string & {});

export interface LiveStateAgent {
  agent_ext: string;
  state: LiveStateAgentState;
  since_ms: number;
}

/**
 * Computed agent counts inside a queue snapshot.
 */
export interface LiveStateAgentCounts {
  total: number;
  available: number;
  on_call: number;
  paused: number;
}

/**
 * One waiting call inside a queue. `position` only appears inside
 * `changes.waiting_added` on a diff — snapshots don't carry it because
 * the array is already ordered.
 */
export interface LiveStateWaiting {
  call_id: string;
  enqueued_at_ms: number;
  peer?: string;
  position?: number;
}

/**
 * Per-queue snapshot/state row.
 */
export interface LiveStateQueue {
  queue_id: string;
  size: number;
  oldest_wait_s: number;
  agents: LiveStateAgentCounts;
  waiting: LiveStateWaiting[];
  agent_list: LiveStateAgent[];
}

/**
 * Snapshot frame — sent once on subscribe and again on any forced
 * reconciliation. `extensions` is the entire authoritative set for the
 * tenant; treat it as a full replace.
 */
export interface LiveStateSnapshot {
  type: 'snapshot';
  scope: 'live_state';
  tenant_id: string;
  ts_ms: number;
  extensions: LiveStateExtension[];
  queues: LiveStateQueue[];
}

/**
 * Extension diff — fields beyond `ext` mirror whatever's now in the
 * Redis HASH. `status === 'idle'` means the extension is back to idle
 * with no call info attached; consumers should drop the optional fields.
 */
export interface LiveStateExtDiff {
  type: 'diff';
  scope: 'ext';
  tenant_id: string;
  ts_ms: number;
  ext: string;
  status: LiveStateExtensionStatus;
  direction?: LiveStateExtensionDirection;
  peer?: string;
  peer_display?: string;
  call_id?: string;
  started_at_ms?: number;
}

/**
 * Queue diff payload — incremental changes only. Consumers must apply
 * these against their local queue state; statesrv does not republish
 * the full queue snapshot on every change.
 */
export interface LiveStateQueueChanges {
  size?: number;
  oldest_wait_s?: number;
  waiting_added?: LiveStateWaiting[];
  waiting_removed?: Array<{ call_id: string }>;
  agents_changed?: LiveStateAgent[];
}

export interface LiveStateQueueDiff {
  type: 'diff';
  scope: 'queue';
  tenant_id: string;
  ts_ms: number;
  queue_id: string;
  changes: LiveStateQueueChanges;
}

/**
 * Discriminated union over the two diff scopes.
 */
export type LiveStateDiff = LiveStateExtDiff | LiveStateQueueDiff;

/**
 * Subscription ack frame — emitted before the initial snapshot frame.
 */
export interface LiveStateSubscriptionAck {
  type: 'subscription_confirmed' | 'subscription_error';
  action: 'subscribe' | 'unsubscribe';
  scope: 'live_state';
  tenant_id: string;
  error?: string;
}

/**
 * Subscription command sent to the server.
 *
 * Note: this is intentionally distinct from `SubscriptionCommand` in
 * `./types.ts` — live_state uses an `{action, type, tenant_id}` envelope
 * keyed off the `live_state` literal; channel/event_type subscriptions
 * use the existing `{type:'subscribe', subscriptionType, ...}` shape.
 * Both shapes coexist on the server; the discriminator on the server
 * side is the presence of `tenant_id` + `type:'live_state'`.
 */
export interface LiveStateSubscriptionCommand {
  action: 'subscribe' | 'unsubscribe';
  type: 'live_state';
  tenant_id: string;
}

/**
 * Snapshot handler — called for the initial snapshot frame and any
 * subsequent reconciliation snapshots.
 */
export type LiveStateSnapshotHandler = (snapshot: LiveStateSnapshot) => void;

/**
 * Diff handler — called for every ext/queue diff frame.
 */
export type LiveStateDiffHandler = (diff: LiveStateDiff) => void;
