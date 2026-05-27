/**
 * Live State → UI Mapping Helpers
 *
 * Pure functions that bridge the snake_case wire shape (`./live-state-types`)
 * to UI-friendly camelCase shapes consumers can render against. These live
 * outside `RealtimeResource` so React reducers, Vue composables, or any
 * framework-agnostic code can call them as plain functions.
 *
 * Why "UI" types live here, not in teamflow-2.0:
 *   - The SDK must not depend on a downstream app's types.
 *   - Consumers shouldn't have to redeclare the bridge shape themselves.
 *   - The shape mirrors teamflow's `Extension` / `LiveQueue` enough that
 *     `Partial<UIType>` slots cleanly into a teamflow reducer.
 *
 * Wire → UI invariants:
 *
 *  Presence map (extension status):
 *  +------------+---------------+
 *  | wire       | UI presence   |
 *  +------------+---------------+
 *  | idle       | available     |
 *  | ringing    | ringing       |
 *  | on_call    | on_call       |
 *  | <other>    | undefined     |
 *  +------------+---------------+
 *
 *  Direction map (call direction):
 *  +------------+---------------+
 *  | wire       | UI direction  |
 *  +------------+---------------+
 *  | inbound    | inbound       |
 *  | outbound   | outbound      |
 *  | internal   | inbound       |
 *  | <other>    | inbound       |
 *  +------------+---------------+
 *
 *  All diff helpers are immutable — they return a fresh array even if no
 *  matching row exists, so reducers can use the result directly.
 */

import type {
  LiveStateAgent,
  LiveStateExtDiff,
  LiveStateExtension,
  LiveStateQueue,
  LiveStateQueueDiff,
  LiveStateWaiting,
} from './live-state-types';

/**
 * UI-friendly extension presence. Mirrors teamflow's `Presence` minus
 * `dnd` and the explicit `offline` (statesrv doesn't track those).
 */
export type LiveStateUIPresence =
  | 'available'
  | 'on_call'
  | 'ringing'
  | 'wrap_up'
  | 'away'
  | 'offline'
  | 'dnd';

/**
 * UI-friendly call direction. statesrv may emit `internal`; the UI only
 * knows `inbound`/`outbound`, so the helper collapses to `inbound`.
 */
export type LiveStateUIDirection = 'inbound' | 'outbound';

/**
 * UI-shaped extension. Only fields derivable from live state are present;
 * properties owned by other systems (avatar, name, team, handle stats)
 * stay out of this shape — consumers merge with their own catalog.
 */
export interface LiveStateExtensionUI {
  ext: string;
  presence?: LiveStateUIPresence;
  /** Wire status pass-through for callers who want the raw value. */
  rawStatus: string;
  /** Last state change in ms-since-epoch. */
  since?: number;
  call: {
    party: string;
    direction: LiveStateUIDirection;
    startedAt: number;
    callId?: string;
  } | null;
}

/**
 * UI-shaped queue agent.
 */
export interface LiveStateAgentUI {
  ext: string;
  status: LiveStateAgent['state'];
  sinceMs: number;
}

/**
 * UI-shaped waiting entry.
 */
export interface LiveStateWaitingUI {
  callId: string;
  enqueuedAt: number;
  party?: string;
  position?: number;
}

/**
 * UI-shaped queue summary. Mirrors teamflow's `LiveQueue` for the fields
 * the live state pipeline can populate; presentation-only fields
 * (`name`, `strategy`, `tone`, `serviceLevel`, etc.) are owned by the
 * caller's catalog.
 */
export interface LiveStateQueueUI {
  id: string;
  size: number;
  oldestWaitS: number;
  agentsOnline: number;
  agentsAvailable: number;
  agentsOnCall: number;
  agentsPaused: number;
  waiting: LiveStateWaitingUI[];
  agents: LiveStateAgentUI[];
}

// ---------------------------------------------------------------------------
// Snapshot/state mappers
// ---------------------------------------------------------------------------

/**
 * Wire-status → UI presence. Unknown statuses come back `undefined`;
 * consumers should fall back to their own presence model.
 */
export function presenceFromStatus(status: string): LiveStateUIPresence | undefined {
  switch (status) {
    case 'idle':
      return 'available';
    case 'on_call':
      return 'on_call';
    case 'ringing':
      return 'ringing';
    default:
      return undefined;
  }
}

/**
 * Wire direction → UI direction. `internal` collapses to `inbound` per
 * the task spec; an unknown direction also lands at `inbound` so the UI
 * never sees `undefined`.
 */
export function directionToUI(direction: string | undefined): LiveStateUIDirection {
  return direction === 'outbound' ? 'outbound' : 'inbound';
}

/**
 * Convert one wire extension row to its UI shape.
 */
export function toUIExtension(wire: LiveStateExtension): LiveStateExtensionUI {
  const presence = presenceFromStatus(wire.status);
  const onCall =
    wire.status !== 'idle' &&
    (wire.peer !== undefined || wire.call_id !== undefined || wire.started_at_ms !== undefined);

  return {
    ext: wire.ext,
    presence,
    rawStatus: wire.status,
    since: wire.updated_at_ms,
    call: onCall
      ? {
          party: wire.peer_display ?? wire.peer ?? '',
          direction: directionToUI(wire.direction),
          startedAt: wire.started_at_ms ?? wire.updated_at_ms ?? 0,
          callId: wire.call_id,
        }
      : null,
  };
}

/**
 * Convert one wire queue row to its UI shape.
 */
export function toUIQueue(wire: LiveStateQueue): LiveStateQueueUI {
  return {
    id: wire.queue_id,
    size: wire.size,
    oldestWaitS: wire.oldest_wait_s,
    agentsOnline: wire.agents.total,
    agentsAvailable: wire.agents.available,
    agentsOnCall: wire.agents.on_call,
    agentsPaused: wire.agents.paused,
    waiting: wire.waiting.map(toUIWaiting),
    agents: wire.agent_list.map(toUIAgent),
  };
}

function toUIWaiting(w: LiveStateWaiting): LiveStateWaitingUI {
  return {
    callId: w.call_id,
    enqueuedAt: w.enqueued_at_ms,
    party: w.peer,
    position: w.position,
  };
}

function toUIAgent(a: LiveStateAgent): LiveStateAgentUI {
  return {
    ext: a.agent_ext,
    status: a.state,
    sinceMs: a.since_ms,
  };
}

// ---------------------------------------------------------------------------
// Diff appliers
// ---------------------------------------------------------------------------

/**
 * Apply an extension diff to an immutable list. Behaviour:
 *  - existing extension: replaced with merged UI row
 *  - new extension: appended
 *  - status === 'idle': call cleared regardless of carry-over fields
 */
export function applyExtDiff(
  state: readonly LiveStateExtensionUI[],
  diff: LiveStateExtDiff
): LiveStateExtensionUI[] {
  const next: LiveStateExtensionUI = toUIExtension({
    ext: diff.ext,
    status: diff.status,
    direction: diff.direction,
    peer: diff.peer,
    peer_display: diff.peer_display,
    call_id: diff.call_id,
    started_at_ms: diff.started_at_ms,
    updated_at_ms: diff.ts_ms,
  });

  const idx = state.findIndex((e) => e.ext === diff.ext);
  if (idx === -1) {
    return [...state, next];
  }
  const copy = state.slice();
  copy[idx] = next;
  return copy;
}

/**
 * Apply a queue diff to an immutable list. Only the fields present in
 * `changes` are touched; everything else carries forward.
 *
 * - `size`, `oldest_wait_s`: overwrite scalars
 * - `waiting_added`: appended, deduped by `call_id`
 * - `waiting_removed`: dropped by `call_id`
 * - `agents_changed`: upserted by `agent_ext`
 *
 * If the queue isn't already in the state, the diff bootstraps a new row
 * with empty defaults — this keeps consumers safe against an early diff
 * before the snapshot lands (statesrv-driven reconciliation snapshots
 * always overwrite the row anyway).
 */
export function applyQueueDiff(
  state: readonly LiveStateQueueUI[],
  diff: LiveStateQueueDiff
): LiveStateQueueUI[] {
  const idx = state.findIndex((q) => q.id === diff.queue_id);
  const existing: LiveStateQueueUI =
    idx === -1
      ? {
          id: diff.queue_id,
          size: 0,
          oldestWaitS: 0,
          agentsOnline: 0,
          agentsAvailable: 0,
          agentsOnCall: 0,
          agentsPaused: 0,
          waiting: [],
          agents: [],
        }
      : state[idx]!;

  const changes = diff.changes ?? {};
  let waiting = existing.waiting;
  if (changes.waiting_removed && changes.waiting_removed.length > 0) {
    const removeIds = new Set(changes.waiting_removed.map((w) => w.call_id));
    waiting = waiting.filter((w) => !removeIds.has(w.callId));
  }
  if (changes.waiting_added && changes.waiting_added.length > 0) {
    const addedIds = new Set(changes.waiting_added.map((w) => w.call_id));
    const surviving = waiting.filter((w) => !addedIds.has(w.callId));
    waiting = [...surviving, ...changes.waiting_added.map(toUIWaiting)];
  }

  let agents = existing.agents;
  if (changes.agents_changed && changes.agents_changed.length > 0) {
    const map = new Map(agents.map((a) => [a.ext, a] as const));
    for (const a of changes.agents_changed) {
      map.set(a.agent_ext, toUIAgent(a));
    }
    agents = Array.from(map.values());
  }

  const merged: LiveStateQueueUI = {
    ...existing,
    size: changes.size ?? existing.size,
    oldestWaitS: changes.oldest_wait_s ?? existing.oldestWaitS,
    waiting,
    agents,
  };

  if (idx === -1) {
    return [...state, merged];
  }
  const copy = state.slice();
  copy[idx] = merged;
  return copy;
}

/**
 * Convenience: rebuild the UI extensions list from a snapshot frame.
 */
export function extensionsFromSnapshot(
  extensions: readonly LiveStateExtension[]
): LiveStateExtensionUI[] {
  return extensions.map(toUIExtension);
}

/**
 * Convenience: rebuild the UI queues list from a snapshot frame.
 */
export function queuesFromSnapshot(queues: readonly LiveStateQueue[]): LiveStateQueueUI[] {
  return queues.map(toUIQueue);
}
