/**
 * Agents Resource
 *
 * Manage AI agents via the agentsrv REST API (proxied through api.veroagents.com)
 */

import type { HttpClient } from '../utils/http';
import type { Agent, ListAgentsParams, CreateAgentParams, UpdateAgentParams, TriggerAgentParams, TriggerAgentResult, JobRole } from '../types';

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

interface JobRoleServerResponse {
  id: string;
  slug: string;
  display_name: string;
  category: string;
  base_prompt?: string;
  base_template: string;
  auto_trigger: boolean;
  suggested_voice?: string;
  is_active: boolean;
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

function transformRole(r: JobRoleServerResponse): JobRole {
  return {
    id: r.id,
    slug: r.slug,
    displayName: r.display_name,
    category: r.category,
    basePrompt: r.base_prompt,
    baseTemplate: r.base_template,
    autoTrigger: r.auto_trigger,
    suggestedVoice: r.suggested_voice,
    isActive: r.is_active,
  };
}

export class AgentsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List AI agents
   */
  async list(params?: ListAgentsParams): Promise<{ agents: Agent[] }> {
    const query: Record<string, string> = {};
    if (params?.status) query.status = params.status;
    const response = await this.http.get<{ agents: AgentServerResponse[] }>('/v1/agents', query);
    return { agents: response.agents.map(transformAgent) };
  }

  /**
   * Get an agent by ID
   */
  async get(agentId: string): Promise<Agent> {
    const response = await this.http.get<AgentServerResponse>(`/v1/agents/${encodeURIComponent(agentId)}`);
    return transformAgent(response);
  }

  /**
   * Create a new AI agent
   */
  async create(params: CreateAgentParams): Promise<Agent> {
    const body: Record<string, unknown> = {
      display_name: params.displayName,
    };
    if (params.roleId !== undefined) body.role_id = params.roleId;
    if (params.ownerUserId !== undefined) body.owner_user_id = params.ownerUserId;
    if (params.context !== undefined) body.context = params.context;
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
    if (params.isDefault !== undefined) body.is_default = params.isDefault;

    const response = await this.http.patch<AgentServerResponse>(`/v1/agents/${encodeURIComponent(agentId)}`, body);
    return transformAgent(response);
  }

  /**
   * Delete an agent
   */
  async delete(agentId: string): Promise<void> {
    await this.http.delete(`/v1/agents/${encodeURIComponent(agentId)}`);
  }

  // ===========================================================================
  // Workspace files (SOUL.md, IDENTITY.md, etc.)
  // ===========================================================================

  /**
   * List workspace files for an agent
   *
   * @example
   * ```typescript
   * const { files } = await veroai.agents.listFiles('agent-uuid');
   * // ['SOUL.md', 'IDENTITY.md', 'AGENTS.md', 'TOOLS.md']
   * ```
   */
  async listFiles(agentId: string, prefix?: string): Promise<{ files: string[] }> {
    const query: Record<string, string> = {};
    if (prefix) query.prefix = prefix;
    return this.http.get<{ files: string[] }>(`/v1/agents/${encodeURIComponent(agentId)}/files`, query);
  }

  /**
   * Read a workspace file
   *
   * @example
   * ```typescript
   * const { content } = await veroai.agents.getFile('agent-uuid', 'SOUL.md');
   * ```
   */
  async getFile(agentId: string, filename: string): Promise<{ filename: string; content: string }> {
    return this.http.get<{ filename: string; content: string }>(
      `/v1/agents/${encodeURIComponent(agentId)}/files/${encodeURIComponent(filename)}`,
    );
  }

  /**
   * Write a workspace file (creates or overwrites)
   *
   * @example
   * ```typescript
   * await veroai.agents.updateFile('agent-uuid', 'SOUL.md', '## Role\nYou are a helpful assistant.');
   * ```
   */
  async updateFile(agentId: string, filename: string, content: string): Promise<void> {
    await this.http.put(
      `/v1/agents/${encodeURIComponent(agentId)}/files/${encodeURIComponent(filename)}`,
      { content },
    );
  }

  /**
   * Delete a workspace file
   */
  async deleteFile(agentId: string, filename: string): Promise<void> {
    await this.http.delete(
      `/v1/agents/${encodeURIComponent(agentId)}/files/${encodeURIComponent(filename)}`,
    );
  }

  /**
   * Trigger an agent run
   *
   * @example
   * ```typescript
   * const result = await veroai.agents.trigger('agent-uuid', {
   *   conversationId: 'conv-uuid',
   *   senderId: 'user-uuid',
   *   message: 'Hello!',
   * });
   * console.log(`Run started: ${result.runId}`);
   * ```
   */
  async trigger(agentId: string, params: TriggerAgentParams): Promise<TriggerAgentResult> {
    const response = await this.http.post<{ run_id: string; status: string }>(
      `/v1/agents/${encodeURIComponent(agentId)}/trigger`,
      {
        conversation_id: params.conversationId,
        sender_id: params.senderId,
        message: params.message,
      },
    );
    return { runId: response.run_id, status: 'accepted' };
  }

  /**
   * List available job roles for agent creation
   *
   * @example
   * ```typescript
   * const { roles } = await veroai.agents.listRoles({ category: 'Special' });
   * ```
   */
  async listRoles(params?: { category?: string; limit?: number }): Promise<{ roles: JobRole[] }> {
    const query: Record<string, string> = {};
    if (params?.category) query.category = params.category;
    if (params?.limit) query.limit = String(params.limit);
    const response = await this.http.get<{ roles: JobRoleServerResponse[] }>('/v1/agents/roles', query);
    return { roles: (response.roles || []).map(transformRole) };
  }

  /**
   * Onboard a personal assistant agent with full role setup.
   * Creates the agent with workspace seeding, conversation, and tools.
   *
   * @example
   * ```typescript
   * const result = await veroai.agents.onboard({
   *   ownerId: 'user-uuid',
   *   displayName: "Drew's Assistant",
   * });
   * ```
   */
  async onboard(params: {
    ownerId: string;
    displayName?: string;
    roleId?: string;
    context?: string;
    avatarUrl?: string;
    voiceId?: string;
    capabilities?: string[];
  }): Promise<{ agentId: string; conversationId: string }> {
    const body: Record<string, unknown> = {
      owner_id: params.ownerId,
      display_name: params.displayName,
      role_id: params.roleId || 'personal-assistant',
      context: params.context,
      avatar_url: params.avatarUrl,
      voice_id: params.voiceId,
    };
    if (params.capabilities !== undefined) body.capabilities = params.capabilities;
    const response = await this.http.post<{ agent_id: string; conversation_id: string }>('/v1/agents/onboard', body);
    return {
      agentId: response.agent_id,
      conversationId: response.conversation_id,
    };
  }
}
