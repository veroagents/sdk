/**
 * Tests for the live-state → UI mapping helpers.
 *
 * These are pure functions; we exercise the wire-to-UI invariants and the
 * immutable diff appliers.
 */

import { describe, expect, it } from 'vitest';

import {
  applyExtDiff,
  applyQueueDiff,
  directionToUI,
  extensionsFromSnapshot,
  presenceFromStatus,
  queuesFromSnapshot,
  toUIExtension,
  toUIQueue,
} from '../../src/realtime/mapping';
import type {
  LiveStateExtDiff,
  LiveStateExtension,
  LiveStateQueue,
  LiveStateQueueDiff,
} from '../../src/realtime/live-state-types';

describe('presenceFromStatus', () => {
  it.each<[string, ReturnType<typeof presenceFromStatus>]>([
    ['idle', 'available'],
    ['ringing', 'ringing'],
    ['on_call', 'on_call'],
    ['wrap_up', undefined],
    ['away', undefined],
    ['dnd', undefined],
    ['offline', undefined],
    ['', undefined],
    ['garbage', undefined],
  ])('maps wire status %s → UI presence %s', (wire, ui) => {
    expect(presenceFromStatus(wire)).toBe(ui);
  });
});

describe('directionToUI', () => {
  it.each<[string | undefined, 'inbound' | 'outbound']>([
    ['inbound', 'inbound'],
    ['outbound', 'outbound'],
    ['internal', 'inbound'],
    [undefined, 'inbound'],
    ['', 'inbound'],
    ['garbage', 'inbound'],
  ])('maps direction %s → %s', (wire, ui) => {
    expect(directionToUI(wire)).toBe(ui);
  });
});

describe('toUIExtension', () => {
  it('produces null call for idle extension', () => {
    const wire: LiveStateExtension = { ext: '1010', status: 'idle', updated_at_ms: 100 };
    expect(toUIExtension(wire)).toEqual({
      ext: '1010',
      presence: 'available',
      rawStatus: 'idle',
      since: 100,
      call: null,
    });
  });

  it('produces call shape for on_call extension', () => {
    const wire: LiveStateExtension = {
      ext: '1010',
      status: 'on_call',
      direction: 'inbound',
      peer: '+972501112233',
      peer_display: 'Rena Okafor',
      call_id: 'c-1',
      started_at_ms: 500,
      updated_at_ms: 510,
    };
    expect(toUIExtension(wire)).toEqual({
      ext: '1010',
      presence: 'on_call',
      rawStatus: 'on_call',
      since: 510,
      call: {
        party: 'Rena Okafor',
        direction: 'inbound',
        startedAt: 500,
        callId: 'c-1',
      },
    });
  });

  it('falls back to peer when peer_display is missing', () => {
    const wire: LiveStateExtension = {
      ext: '1010',
      status: 'on_call',
      peer: '+972501112233',
      call_id: 'c-1',
      started_at_ms: 500,
    };
    expect(toUIExtension(wire).call?.party).toBe('+972501112233');
  });

  it('folds `internal` direction to inbound', () => {
    const wire: LiveStateExtension = {
      ext: '1010',
      status: 'on_call',
      direction: 'internal',
      peer: '1011',
      started_at_ms: 1,
    };
    expect(toUIExtension(wire).call?.direction).toBe('inbound');
  });

  it('leaves presence undefined for unknown status', () => {
    const wire: LiveStateExtension = { ext: '1010', status: 'wrap_up', updated_at_ms: 1 };
    expect(toUIExtension(wire).presence).toBeUndefined();
  });
});

describe('toUIQueue', () => {
  it('maps wire queue to UI shape', () => {
    const wire: LiveStateQueue = {
      queue_id: 'support',
      size: 2,
      oldest_wait_s: 30,
      agents: { total: 5, available: 2, on_call: 3, paused: 0 },
      waiting: [
        { call_id: 'c-1', enqueued_at_ms: 100, peer: '+9725010' },
        { call_id: 'c-2', enqueued_at_ms: 200 },
      ],
      agent_list: [{ agent_ext: '1010', state: 'on_call', since_ms: 50 }],
    };
    expect(toUIQueue(wire)).toEqual({
      id: 'support',
      size: 2,
      oldestWaitS: 30,
      agentsOnline: 5,
      agentsAvailable: 2,
      agentsOnCall: 3,
      agentsPaused: 0,
      waiting: [
        { callId: 'c-1', enqueuedAt: 100, party: '+9725010', position: undefined },
        { callId: 'c-2', enqueuedAt: 200, party: undefined, position: undefined },
      ],
      agents: [{ ext: '1010', status: 'on_call', sinceMs: 50 }],
    });
  });
});

describe('extensionsFromSnapshot / queuesFromSnapshot', () => {
  it('maps an extension snapshot list', () => {
    const list: LiveStateExtension[] = [
      { ext: '1010', status: 'idle', updated_at_ms: 1 },
      { ext: '1011', status: 'on_call', peer: 'a', started_at_ms: 2 },
    ];
    const ui = extensionsFromSnapshot(list);
    expect(ui).toHaveLength(2);
    expect(ui[0]!.call).toBeNull();
    expect(ui[1]!.call?.party).toBe('a');
  });

  it('maps a queue snapshot list', () => {
    const list: LiveStateQueue[] = [
      {
        queue_id: 'q1',
        size: 0,
        oldest_wait_s: 0,
        agents: { total: 0, available: 0, on_call: 0, paused: 0 },
        waiting: [],
        agent_list: [],
      },
    ];
    expect(queuesFromSnapshot(list)).toHaveLength(1);
  });
});

describe('applyExtDiff', () => {
  it('replaces an existing extension', () => {
    const initial = [toUIExtension({ ext: '1010', status: 'idle', updated_at_ms: 1 })];
    const diff: LiveStateExtDiff = {
      type: 'diff',
      scope: 'ext',
      tenant_id: 't',
      ts_ms: 2,
      ext: '1010',
      status: 'on_call',
      direction: 'inbound',
      peer: 'Rena',
      started_at_ms: 2,
    };
    const next = applyExtDiff(initial, diff);
    expect(next).toHaveLength(1);
    expect(next[0]!.presence).toBe('on_call');
    expect(next[0]!.call?.party).toBe('Rena');
    expect(next).not.toBe(initial);
  });

  it('appends a new extension', () => {
    const initial = [toUIExtension({ ext: '1010', status: 'idle', updated_at_ms: 1 })];
    const diff: LiveStateExtDiff = {
      type: 'diff',
      scope: 'ext',
      tenant_id: 't',
      ts_ms: 2,
      ext: '1011',
      status: 'ringing',
    };
    const next = applyExtDiff(initial, diff);
    expect(next).toHaveLength(2);
    expect(next[1]!.ext).toBe('1011');
    expect(next[1]!.presence).toBe('ringing');
  });

  it('clears call info when transitioning to idle', () => {
    const initial = [
      toUIExtension({
        ext: '1010',
        status: 'on_call',
        peer: 'Rena',
        started_at_ms: 100,
        updated_at_ms: 100,
      }),
    ];
    const diff: LiveStateExtDiff = {
      type: 'diff',
      scope: 'ext',
      tenant_id: 't',
      ts_ms: 200,
      ext: '1010',
      status: 'idle',
    };
    const next = applyExtDiff(initial, diff);
    expect(next[0]!.call).toBeNull();
    expect(next[0]!.presence).toBe('available');
  });

  it('does not mutate the input array', () => {
    const initial = Object.freeze([
      toUIExtension({ ext: '1010', status: 'idle', updated_at_ms: 1 }),
    ]) as ReturnType<typeof toUIExtension>[];
    const diff: LiveStateExtDiff = {
      type: 'diff',
      scope: 'ext',
      tenant_id: 't',
      ts_ms: 2,
      ext: '1010',
      status: 'ringing',
    };
    expect(() => applyExtDiff(initial, diff)).not.toThrow();
  });
});

describe('applyQueueDiff', () => {
  const seed = (): ReturnType<typeof toUIQueue>[] => [
    toUIQueue({
      queue_id: 'support',
      size: 1,
      oldest_wait_s: 10,
      agents: { total: 2, available: 1, on_call: 1, paused: 0 },
      waiting: [{ call_id: 'c-1', enqueued_at_ms: 100 }],
      agent_list: [{ agent_ext: '1010', state: 'on_call', since_ms: 50 }],
    }),
  ];

  it('overwrites scalar size + oldestWaitS', () => {
    const diff: LiveStateQueueDiff = {
      type: 'diff',
      scope: 'queue',
      tenant_id: 't',
      ts_ms: 200,
      queue_id: 'support',
      changes: { size: 3, oldest_wait_s: 42 },
    };
    const next = applyQueueDiff(seed(), diff);
    expect(next[0]!.size).toBe(3);
    expect(next[0]!.oldestWaitS).toBe(42);
    // waiting/agents must be untouched
    expect(next[0]!.waiting).toHaveLength(1);
  });

  it('adds waiting entries', () => {
    const diff: LiveStateQueueDiff = {
      type: 'diff',
      scope: 'queue',
      tenant_id: 't',
      ts_ms: 200,
      queue_id: 'support',
      changes: {
        waiting_added: [
          { call_id: 'c-2', enqueued_at_ms: 150, peer: '+972', position: 2 },
        ],
      },
    };
    const next = applyQueueDiff(seed(), diff);
    expect(next[0]!.waiting).toHaveLength(2);
    expect(next[0]!.waiting[1]).toEqual({
      callId: 'c-2',
      enqueuedAt: 150,
      party: '+972',
      position: 2,
    });
  });

  it('removes waiting entries by call_id', () => {
    const diff: LiveStateQueueDiff = {
      type: 'diff',
      scope: 'queue',
      tenant_id: 't',
      ts_ms: 200,
      queue_id: 'support',
      changes: { waiting_removed: [{ call_id: 'c-1' }] },
    };
    const next = applyQueueDiff(seed(), diff);
    expect(next[0]!.waiting).toHaveLength(0);
  });

  it('upserts agents by agent_ext', () => {
    const diff: LiveStateQueueDiff = {
      type: 'diff',
      scope: 'queue',
      tenant_id: 't',
      ts_ms: 200,
      queue_id: 'support',
      changes: {
        agents_changed: [
          { agent_ext: '1010', state: 'available', since_ms: 200 },
          { agent_ext: '1011', state: 'on_call', since_ms: 210 },
        ],
      },
    };
    const next = applyQueueDiff(seed(), diff);
    expect(next[0]!.agents).toHaveLength(2);
    const updated = next[0]!.agents.find((a) => a.ext === '1010')!;
    expect(updated.status).toBe('available');
    expect(updated.sinceMs).toBe(200);
  });

  it('bootstraps an unknown queue from an early diff', () => {
    const diff: LiveStateQueueDiff = {
      type: 'diff',
      scope: 'queue',
      tenant_id: 't',
      ts_ms: 1,
      queue_id: 'newq',
      changes: { size: 1 },
    };
    const next = applyQueueDiff([], diff);
    expect(next).toHaveLength(1);
    expect(next[0]!.id).toBe('newq');
    expect(next[0]!.size).toBe(1);
  });
});
