/**
 * Brain Resource
 *
 * Structured agent memory: semantic facts, episodic moments, graph relationships,
 * task state. Agents coordinate through brain writes and subscriptions — no
 * direct agent-to-agent messaging.
 */

import type { HttpClient } from '../utils/http';
import type {
  BrainEntry,
  BrainEvent,
  BrainQueryParams,
  BrainQueryResult,
  BrainReadParams,
  BrainScope,
  BrainSubscribeParams,
  BrainWriteParams,
} from '../types';

interface BrainEntryServerResponse {
  id: string;
  agent_id: string;
  scope: BrainScope;
  key: string;
  value: unknown;
  tags?: string[];
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

function transformEntry(e: BrainEntryServerResponse): BrainEntry {
  return {
    id: e.id,
    agentId: e.agent_id,
    scope: e.scope,
    key: e.key,
    value: e.value,
    tags: e.tags ?? [],
    createdAt: e.created_at,
    updatedAt: e.updated_at,
    expiresAt: e.expires_at,
  };
}

export class BrainResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Write a value into a brain scope. Any subscriber matching the scope/key
   * is notified asynchronously.
   *
   * @example
   * ```typescript
   * await veroai.brain.write({
   *   agentId: 'agent-uuid',
   *   scope: 'episodic',
   *   key: 'call:8291:transcript',
   *   value: { text: '...', language: 'he' },
   *   tags: ['call', 'hebrew'],
   * });
   * ```
   */
  async write(params: BrainWriteParams): Promise<BrainEntry> {
    const body: Record<string, unknown> = {
      scope: params.scope,
      key: params.key,
      value: params.value,
    };
    if (params.ttl !== undefined) body.ttl = params.ttl;
    if (params.tags !== undefined) body.tags = params.tags;

    const response = await this.http.post<BrainEntryServerResponse>(
      `/v1/brain/${encodeURIComponent(params.agentId)}`,
      body,
    );
    return transformEntry(response);
  }

  /**
   * Read a single entry by exact key
   */
  async read(params: BrainReadParams): Promise<BrainEntry | null> {
    try {
      const response = await this.http.get<BrainEntryServerResponse>(
        `/v1/brain/${encodeURIComponent(params.agentId)}/${encodeURIComponent(
          params.scope,
        )}/${encodeURIComponent(params.key)}`,
      );
      return transformEntry(response);
    } catch (err) {
      if (err && typeof err === 'object' && 'statusCode' in err && err.statusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Query the brain with hybrid search + token budget.
   *
   * @example
   * ```typescript
   * const { context, entries } = await veroai.brain.query({
   *   agentId: 'agent-uuid',
   *   q: 'what does david prefer',
   *   budget: 2000,
   * });
   * ```
   */
  async query(params: BrainQueryParams): Promise<BrainQueryResult> {
    const query: Record<string, string> = {};
    if (params.scope) query.scope = params.scope;
    if (params.q) query.q = params.q;
    if (params.budget !== undefined) query.budget = String(params.budget);
    if (params.tags !== undefined) query.tags = params.tags.join(',');
    if (params.limit !== undefined) query.limit = String(params.limit);
    if (params.offset !== undefined) query.offset = String(params.offset);

    const response = await this.http.get<{
      entries: BrainEntryServerResponse[];
      context?: string;
    }>(`/v1/brain/${encodeURIComponent(params.agentId)}/query`, query);
    return {
      entries: (response.entries || []).map(transformEntry),
      context: response.context,
    };
  }

  /**
   * Delete an entry
   */
  async delete(agentId: string, scope: BrainScope, key: string): Promise<void> {
    await this.http.delete(
      `/v1/brain/${encodeURIComponent(agentId)}/${encodeURIComponent(
        scope,
      )}/${encodeURIComponent(key)}`,
    );
  }

  /**
   * Subscribe to brain writes via SSE. The returned async iterator yields
   * `BrainEvent` frames as other agents (or the caller) write into scopes.
   *
   * This is the "telepathy" primitive — agents read updates without any
   * direct message being sent between them.
   *
   * @example
   * ```typescript
   * const controller = new AbortController();
   * for await (const ev of veroai.brain.subscribe({ agentId, scope: 'episodic' }, { signal: controller.signal })) {
   *   console.log(ev.type, ev.entry.key);
   * }
   * ```
   */
  async *subscribe(
    params: BrainSubscribeParams,
    opts?: { signal?: AbortSignal },
  ): AsyncGenerator<BrainEvent, void, void> {
    const baseUrl = this.http.getBaseUrl();
    const url = new URL(
      `/v1/brain/${encodeURIComponent(params.agentId)}/subscribe`,
      baseUrl,
    );
    if (params.scope) url.searchParams.set('scope', params.scope);
    if (params.keyPrefix) url.searchParams.set('key_prefix', params.keyPrefix);

    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      ...this.http.getAuthHeaders(),
    };

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
      signal: opts?.signal,
    });
    if (!response.ok || !response.body) {
      throw new Error(
        `Brain subscription failed: ${String(response.status)} ${response.statusText}`,
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const dataLine = raw.split('\n').find((l) => l.startsWith('data:'));
        if (!dataLine) continue;
        const payload = dataLine.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const parsed = JSON.parse(payload) as {
            type: BrainEvent['type'];
            at: string;
            entry: BrainEntryServerResponse;
          };
          yield {
            type: parsed.type,
            at: parsed.at,
            entry: transformEntry(parsed.entry),
          };
        } catch {
          // Skip malformed frames.
        }
      }
    }
  }
}
