/**
 * Tests for the live_state subscription path on RealtimeResource.
 *
 * Strategy: stub `globalThis.window.WebSocket` with an in-memory mock so
 * RealtimeResource's `isBrowser()` check succeeds and we control message
 * flow (open / message / close) directly from the test.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RealtimeResource } from '../../src/realtime/realtime';
import type {
  LiveStateExtDiff,
  LiveStateQueueDiff,
  LiveStateSnapshot,
  LiveStateSubscriptionAck,
} from '../../src/realtime/live-state-types';

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

interface SentFrame {
  raw: string;
  parsed: Record<string, unknown>;
}

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  url: string;
  onopen: ((event?: unknown) => void) | null = null;
  onclose: ((event: { reason?: string; code?: number }) => void) | null = null;
  onerror: ((event: { message?: string }) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  sent: SentFrame[] = [];
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    // Schedule open on next tick so the constructor returns first.
    queueMicrotask(() => {
      this.onopen?.();
    });
  }

  send(data: string): void {
    this.sent.push({ raw: data, parsed: JSON.parse(data) });
  }

  close(code?: number, reason?: string): void {
    if (this.closed) return;
    this.closed = true;
    this.onclose?.({ code, reason });
  }

  /** Helper to deliver a server frame to the SDK. */
  deliver(frame: Record<string, unknown>): void {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }

  /** Wait for `n` frames to have been queued by the SDK. */
  async waitForSent(n: number, timeoutMs = 200): Promise<void> {
    const start = Date.now();
    while (this.sent.length < n) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(`Timed out waiting for ${n} sent frames; got ${this.sent.length}`);
      }
      await new Promise<void>((r) => setTimeout(r, 5));
    }
  }
}

const tokenFetcher = vi.fn(async () => 'test-token');

beforeEach(() => {
  MockWebSocket.instances = [];
  tokenFetcher.mockClear();
  // RealtimeResource probes `globalThis.window.WebSocket` via the
  // `typeof window` check; we install a window with our mock so the
  // browser branch fires and we never load the real `ws` package.
  (globalThis as unknown as { window: { WebSocket: typeof MockWebSocket } }).window = {
    WebSocket: MockWebSocket,
  };
});

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

/**
 * Build a connected resource — caller drives the rest of the wire flow.
 */
async function connectedResource(): Promise<{
  rt: RealtimeResource;
  ws: MockWebSocket;
}> {
  const rt = new RealtimeResource(tokenFetcher, {
    url: 'wss://test/ws',
    autoReconnect: false,
    heartbeatInterval: 60_000,
  });
  await rt.connect();
  const ws = MockWebSocket.instances.at(-1)!;
  return { rt, ws };
}

const TENANT = 'tenant-uuid-1';

const makeSnapshot = (
  tenantId = TENANT,
  overrides?: Partial<LiveStateSnapshot>
): LiveStateSnapshot => ({
  type: 'snapshot',
  scope: 'live_state',
  tenant_id: tenantId,
  ts_ms: 1000,
  extensions: [
    { ext: '1010', status: 'idle', updated_at_ms: 1000 },
  ],
  queues: [
    {
      queue_id: 'support',
      size: 0,
      oldest_wait_s: 0,
      agents: { total: 0, available: 0, on_call: 0, paused: 0 },
      waiting: [],
      agent_list: [],
    },
  ],
  ...overrides,
});

const confirmAck = (tenantId = TENANT): LiveStateSubscriptionAck => ({
  type: 'subscription_confirmed',
  action: 'subscribe',
  scope: 'live_state',
  tenant_id: tenantId,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('subscribeLiveState', () => {
  it('sends the correct wire frame', async () => {
    const { rt, ws } = await connectedResource();

    const pending = rt.subscribeLiveState(TENANT);
    await ws.waitForSent(1);

    expect(ws.sent[0]!.parsed).toEqual({
      action: 'subscribe',
      type: 'live_state',
      tenant_id: TENANT,
    });

    ws.deliver(confirmAck());
    ws.deliver(makeSnapshot());
    const snap = await pending;
    expect(snap.tenant_id).toBe(TENANT);
    expect(snap.extensions).toHaveLength(1);
  });

  it('does NOT resolve on the ack alone — waits for the snapshot', async () => {
    const { rt, ws } = await connectedResource();
    const pending = rt.subscribeLiveState(TENANT);
    await ws.waitForSent(1);

    ws.deliver(confirmAck());
    // Race the ack against the promise: if the SDK incorrectly resolved on
    // ack alone, `Promise.race` would return our sentinel below.
    const winner = await Promise.race([
      pending.then(() => 'snapshot' as const),
      new Promise<'no-resolve'>((r) => setTimeout(() => r('no-resolve'), 50)),
    ]);
    expect(winner).toBe('no-resolve');

    ws.deliver(makeSnapshot());
    await pending;
  });

  it('rejects on subscription_error', async () => {
    const { rt, ws } = await connectedResource();
    const pending = rt.subscribeLiveState(TENANT);
    await ws.waitForSent(1);

    ws.deliver({
      type: 'subscription_error',
      action: 'subscribe',
      scope: 'live_state',
      tenant_id: TENANT,
      error: 'tenant_not_authorized',
    });

    await expect(pending).rejects.toThrow('tenant_not_authorized');
    expect(rt.getLiveStateTenants()).toEqual([]);
  });

  it('delivers snapshot to onLiveStateSnapshot handlers', async () => {
    const { rt, ws } = await connectedResource();
    const handler = vi.fn();
    const unregister = rt.onLiveStateSnapshot(handler);

    const pending = rt.subscribeLiveState(TENANT);
    await ws.waitForSent(1);
    ws.deliver(confirmAck());
    const snap = makeSnapshot();
    ws.deliver(snap);
    await pending;

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(snap);

    unregister();
    ws.deliver(makeSnapshot(TENANT, { ts_ms: 2000 }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('delivers diff frames to onLiveStateDiff handlers', async () => {
    const { rt, ws } = await connectedResource();
    const handler = vi.fn();
    rt.onLiveStateDiff(handler);

    const pending = rt.subscribeLiveState(TENANT);
    await ws.waitForSent(1);
    ws.deliver(confirmAck());
    ws.deliver(makeSnapshot());
    await pending;

    const extDiff: LiveStateExtDiff = {
      type: 'diff',
      scope: 'ext',
      tenant_id: TENANT,
      ts_ms: 1100,
      ext: '1010',
      status: 'on_call',
      direction: 'inbound',
      peer: '+972501112233',
      call_id: 'c-1',
      started_at_ms: 1100,
    };
    ws.deliver(extDiff);

    const queueDiff: LiveStateQueueDiff = {
      type: 'diff',
      scope: 'queue',
      tenant_id: TENANT,
      ts_ms: 1200,
      queue_id: 'support',
      changes: {
        size: 1,
        oldest_wait_s: 12,
        waiting_added: [{ call_id: 'c-1', enqueued_at_ms: 1188, peer: '+972', position: 1 }],
      },
    };
    ws.deliver(queueDiff);

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenNthCalledWith(1, extDiff);
    expect(handler).toHaveBeenNthCalledWith(2, queueDiff);
  });

  it('short-circuits a duplicate subscribe with the cached snapshot', async () => {
    const { rt, ws } = await connectedResource();

    const first = rt.subscribeLiveState(TENANT);
    await ws.waitForSent(1);
    ws.deliver(confirmAck());
    const snap = makeSnapshot();
    ws.deliver(snap);
    await first;

    const second = await rt.subscribeLiveState(TENANT);
    expect(second).toStrictEqual(snap);
    // No second frame should have been sent.
    expect(ws.sent).toHaveLength(1);
  });
});

describe('unsubscribeLiveState', () => {
  it('sends the correct wire frame and resolves on ack', async () => {
    const { rt, ws } = await connectedResource();

    // Subscribe first so we have something to unsubscribe.
    const sub = rt.subscribeLiveState(TENANT);
    await ws.waitForSent(1);
    ws.deliver(confirmAck());
    ws.deliver(makeSnapshot());
    await sub;

    const pending = rt.unsubscribeLiveState(TENANT);
    await ws.waitForSent(2);
    expect(ws.sent[1]!.parsed).toEqual({
      action: 'unsubscribe',
      type: 'live_state',
      tenant_id: TENANT,
    });

    ws.deliver({
      type: 'subscription_confirmed',
      action: 'unsubscribe',
      scope: 'live_state',
      tenant_id: TENANT,
    });
    await pending;
    expect(rt.getLiveStateTenants()).toEqual([]);
  });

  it('is a no-op when disconnected', async () => {
    const rt = new RealtimeResource(tokenFetcher, {
      url: 'wss://test/ws',
      autoReconnect: false,
    });
    // No connect — straight to unsubscribe.
    await expect(rt.unsubscribeLiveState(TENANT)).resolves.toBeUndefined();
  });
});

describe('reconnect', () => {
  it('re-sends subscribe for every tracked tenant after reconnect', async () => {
    const rt = new RealtimeResource(tokenFetcher, {
      url: 'wss://test/ws',
      autoReconnect: true,
      reconnectInterval: 10,
      maxReconnectAttempts: 5,
      heartbeatInterval: 60_000,
    });
    await rt.connect();
    const ws1 = MockWebSocket.instances.at(-1)!;

    // Subscribe two tenants.
    const t1 = 'tenant-1';
    const t2 = 'tenant-2';

    const p1 = rt.subscribeLiveState(t1);
    await ws1.waitForSent(1);
    ws1.deliver(confirmAck(t1));
    ws1.deliver(makeSnapshot(t1));
    await p1;

    const p2 = rt.subscribeLiveState(t2);
    await ws1.waitForSent(2);
    ws1.deliver(confirmAck(t2));
    ws1.deliver(makeSnapshot(t2));
    await p2;

    expect(rt.getLiveStateTenants().sort()).toEqual([t1, t2]);

    // Force reconnect.
    ws1.close(1006, 'network');

    // Wait for the new socket to appear (reconnectInterval=10 + microtasks).
    const start = Date.now();
    while (MockWebSocket.instances.length < 2) {
      if (Date.now() - start > 500) {
        throw new Error('Reconnect socket never created');
      }
      await new Promise<void>((r) => setTimeout(r, 5));
    }
    const ws2 = MockWebSocket.instances[1]!;

    // Two subscribe frames should be queued on the new socket (one per
    // tracked tenant). Order isn't guaranteed because resubscribe fires
    // them in parallel.
    await ws2.waitForSent(2);
    const sentTenants = ws2.sent.map((f) => f.parsed['tenant_id']).sort();
    expect(sentTenants).toEqual([t1, t2]);

    for (const frame of ws2.sent) {
      expect(frame.parsed['action']).toBe('subscribe');
      expect(frame.parsed['type']).toBe('live_state');
    }

    rt.disconnect();
  });
});

describe('routing isolation', () => {
  it('does not invoke onEvent for snapshot/diff frames', async () => {
    const { rt, ws } = await connectedResource();
    const onEvent = vi.fn();
    rt.onEvent(onEvent);

    const pending = rt.subscribeLiveState(TENANT);
    await ws.waitForSent(1);
    ws.deliver(confirmAck());
    ws.deliver(makeSnapshot());
    await pending;

    ws.deliver({
      type: 'diff',
      scope: 'ext',
      tenant_id: TENANT,
      ts_ms: 1,
      ext: '1010',
      status: 'on_call',
    });

    expect(onEvent).not.toHaveBeenCalled();
  });

  it('does not invoke onLiveStateSnapshot for non-live_state subscription_confirmed frames', async () => {
    const { rt, ws } = await connectedResource();
    const handler = vi.fn();
    rt.onLiveStateSnapshot(handler);

    // Channel-style ack (no scope).
    ws.deliver({
      type: 'subscription_confirmed',
      action: 'subscribe',
      subscriptionType: 'channel',
      items: ['ch_1'],
    });

    expect(handler).not.toHaveBeenCalled();
  });
});
