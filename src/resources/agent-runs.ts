/**
 * Agent Runs Resource
 *
 * Inspect and stream agent runs.
 */

import type { HttpClient } from '../utils/http';
import type {
  AgentRun,
  AgentRunEvent,
  AgentRunStatus,
  ListAgentRunsParams,
} from '../types';

interface AgentRunServerResponse {
  id: string;
  agent_id: string;
  conversation_id: string;
  sender_id: string;
  status: AgentRunStatus;
  turns: number;
  started_at: string;
  ended_at?: string;
  error?: string;
}

function transformRun(r: AgentRunServerResponse): AgentRun {
  return {
    id: r.id,
    agentId: r.agent_id,
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    status: r.status,
    turns: r.turns,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    error: r.error,
  };
}

export class AgentRunsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List runs, optionally filtered by agent or conversation
   *
   * @example
   * ```typescript
   * const { runs } = await veroai.agents.runs.list({ agentId: 'agent-uuid', limit: 20 });
   * ```
   */
  async list(params?: ListAgentRunsParams): Promise<{ runs: AgentRun[] }> {
    const query: Record<string, string> = {};
    if (params?.agentId) query.agent_id = params.agentId;
    if (params?.conversationId) query.conversation_id = params.conversationId;
    if (params?.status) query.status = params.status;
    if (params?.limit !== undefined) query.limit = String(params.limit);
    if (params?.offset !== undefined) query.offset = String(params.offset);

    const response = await this.http.get<{ runs: AgentRunServerResponse[] }>(
      '/v1/agents/runs',
      query,
    );
    return { runs: (response.runs || []).map(transformRun) };
  }

  /**
   * Get a single run by ID
   *
   * @example
   * ```typescript
   * const run = await veroai.agents.runs.get('run_abc123');
   * console.log(run.status, run.turns);
   * ```
   */
  async get(runId: string): Promise<AgentRun> {
    const response = await this.http.get<AgentRunServerResponse>(
      `/v1/agents/runs/${encodeURIComponent(runId)}`,
    );
    return transformRun(response);
  }

  /**
   * Cancel a running run
   */
  async cancel(runId: string): Promise<void> {
    await this.http.post(`/v1/agents/runs/${encodeURIComponent(runId)}/cancel`, {});
  }

  /**
   * Stream run events via SSE.
   *
   * Iterates token/tool_call/message/done events until the run completes,
   * fails, or the caller aborts via the returned controller.
   *
   * @example
   * ```typescript
   * const controller = new AbortController();
   * for await (const ev of veroai.agents.runs.stream('run_abc123', { signal: controller.signal })) {
   *   if (ev.type === 'token') process.stdout.write(String(ev.data.text));
   *   if (ev.type === 'done') break;
   * }
   * ```
   */
  async *stream(
    runId: string,
    opts?: { signal?: AbortSignal },
  ): AsyncGenerator<AgentRunEvent, void, void> {
    const baseUrl = this.http.getBaseUrl();
    const url = new URL(
      `/v1/agents/runs/${encodeURIComponent(runId)}/events`,
      baseUrl,
    );
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
      throw new Error(`Stream failed: ${String(response.status)} ${response.statusText}`);
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
        const dataLine = raw
          .split('\n')
          .find((l) => l.startsWith('data:'));
        if (!dataLine) continue;
        const payload = dataLine.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          yield JSON.parse(payload) as AgentRunEvent;
        } catch {
          // Skip malformed frames.
        }
      }
    }
  }
}
