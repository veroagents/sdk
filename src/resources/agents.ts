/**
 * Agents Resource
 *
 * Manage AI agents via the agentsrv REST API (proxied through api.veroagents.com)
 */

import type { HttpClient } from '../utils/http';
import type { Agent, ListAgentsParams, CreateAgentParams, UpdateAgentParams } from '../types';

// Server response (snake_case from agentsrv)
interface AgentServerResponse {
  id: string;
  tenant_id: string;
  owner_user_id: string;
  display_name: string;
  avatar_url: string;
  agent_type: string;
  model: string;
  prompt_mode: string;
  system_prompt: string;
  job_title: string;
  voice_id: string;
  language: string;
  background_noise: string;
  typing_noise: boolean;
  auto_trigger: boolean;
  status: string;
  scope: string;
  created_at: string;
}

function transformAgent(a: AgentServerResponse): Agent {
  return {
    id: a.id,
    tenantId: a.tenant_id,
    ownerUserId: a.owner_user_id,
    displayName: a.display_name,
    avatarUrl: a.avatar_url || undefined,
    agentType: a.agent_type,
    model: a.model,
    promptMode: a.prompt_mode,
    systemPrompt: a.system_prompt,
    jobTitle: a.job_title || undefined,
    voiceId: a.voice_id || undefined,
    language: a.language,
    backgroundNoise: a.background_noise,
    typingNoise: a.typing_noise,
    autoTrigger: a.auto_trigger,
    status: a.status as Agent['status'],
    scope: a.scope,
    createdAt: a.created_at,
  };
}

export class AgentsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List AI agents
   *
   * @example
   * ```typescript
   * const { agents } = await veroai.agents.list({ status: 'active' });
   * for (const agent of agents) {
   *   console.log(`${agent.displayName} (${agent.model})`);
   * }
   * ```
   */
  async list(params?: ListAgentsParams): Promise<{ agents: Agent[] }> {
    const query: Record<string, string> = {};
    if (params?.status) query.status = params.status;
    const response = await this.http.get<{ agents: AgentServerResponse[] }>('/v1/agents', query);
    return { agents: response.agents.map(transformAgent) };
  }

  /**
   * Get an agent by ID
   *
   * @example
   * ```typescript
   * const agent = await veroai.agents.get('uuid-here');
   * console.log(`System prompt: ${agent.systemPrompt}`);
   * ```
   */
  async get(agentId: string): Promise<Agent> {
    const response = await this.http.get<AgentServerResponse>(`/v1/agents/${encodeURIComponent(agentId)}`);
    return transformAgent(response);
  }

  /**
   * Create a new AI agent
   *
   * @example
   * ```typescript
   * const agent = await veroai.agents.create({
   *   displayName: 'Support Agent',
   *   model: 'claude-sonnet-4-20250514',
   *   systemPrompt: 'You are a helpful support agent...',
   * });
   * ```
   */
  async create(params: CreateAgentParams): Promise<Agent> {
    const body: Record<string, unknown> = {
      display_name: params.displayName,
    };
    if (params.roleId !== undefined) body.role_id = params.roleId;
    if (params.agentType !== undefined) body.agent_type = params.agentType;
    if (params.model !== undefined) body.model = params.model;
    if (params.systemPrompt !== undefined) body.system_prompt = params.systemPrompt;
    if (params.avatarUrl !== undefined) body.avatar_url = params.avatarUrl;
    if (params.voiceId !== undefined) body.voice_id = params.voiceId;
    if (params.language !== undefined) body.language = params.language;
    if (params.backgroundNoise !== undefined) body.background_noise = params.backgroundNoise;
    if (params.typingNoise !== undefined) body.typing_noise = params.typingNoise;
    if (params.autoTrigger !== undefined) body.auto_trigger = params.autoTrigger;

    const response = await this.http.post<AgentServerResponse>('/v1/agents', body);
    return transformAgent(response);
  }

  /**
   * Update an agent
   *
   * @example
   * ```typescript
   * const agent = await veroai.agents.update('uuid-here', {
   *   systemPrompt: 'Updated prompt...',
   *   model: 'claude-sonnet-4-20250514',
   * });
   * ```
   */
  async update(agentId: string, params: UpdateAgentParams): Promise<Agent> {
    const body: Record<string, unknown> = {};
    if (params.displayName !== undefined) body.display_name = params.displayName;
    if (params.avatarUrl !== undefined) body.avatar_url = params.avatarUrl;
    if (params.agentType !== undefined) body.agent_type = params.agentType;
    if (params.model !== undefined) body.model = params.model;
    if (params.promptMode !== undefined) body.prompt_mode = params.promptMode;
    if (params.systemPrompt !== undefined) body.system_prompt = params.systemPrompt;
    if (params.jobTitle !== undefined) body.job_title = params.jobTitle;
    if (params.voiceId !== undefined) body.voice_id = params.voiceId;
    if (params.language !== undefined) body.language = params.language;
    if (params.backgroundNoise !== undefined) body.background_noise = params.backgroundNoise;
    if (params.typingNoise !== undefined) body.typing_noise = params.typingNoise;
    if (params.autoTrigger !== undefined) body.auto_trigger = params.autoTrigger;
    if (params.scope !== undefined) body.scope = params.scope;

    const response = await this.http.patch<AgentServerResponse>(`/v1/agents/${encodeURIComponent(agentId)}`, body);
    return transformAgent(response);
  }

  /**
   * Delete an agent
   *
   * @example
   * ```typescript
   * await veroai.agents.delete('uuid-here');
   * ```
   */
  async delete(agentId: string): Promise<void> {
    await this.http.delete(`/v1/agents/${encodeURIComponent(agentId)}`);
  }
}
