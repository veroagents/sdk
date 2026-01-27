/**
 * Agents Resource
 *
 * Manage AI agent configurations for voice and messaging
 */

import type { HttpClient } from '../utils/http';
import type {
  AgentConfig,
  ListAgentsParams,
  CreateAgentParams,
  UpdateAgentParams,
  PaginatedResponse,
} from '../types';

// API response types (snake_case from server)
interface AgentResponse {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  is_default: boolean;
  model_config: {
    provider: 'anthropic' | 'openai';
    model_id: string;
    temperature: number;
    max_tokens: number;
  };
  system_prompt: string;
  status: 'draft' | 'active' | 'archived';
  version: number;
  created_at: string;
  updated_at: string;
}

interface ListAgentsResponse {
  agents: AgentResponse[];
  total: number;
  limit: number;
  offset: number;
}

function transformAgent(agent: AgentResponse): AgentConfig {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    enabled: agent.enabled,
    modelConfig: {
      provider: agent.model_config.provider,
      modelId: agent.model_config.model_id,
      temperature: agent.model_config.temperature,
      maxTokens: agent.model_config.max_tokens,
    },
    systemPrompt: agent.system_prompt,
    status: agent.status,
  };
}

export class AgentsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List AI agents
   *
   * @example
   * ```typescript
   * const agents = await veroai.agents.list({ status: 'active' });
   * for (const agent of agents.data) {
   *   console.log(`${agent.name} (${agent.modelConfig.provider})`);
   * }
   * ```
   */
  async list(params?: ListAgentsParams): Promise<PaginatedResponse<AgentConfig>> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.enabled !== undefined) searchParams.set('enabled', String(params.enabled));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));

    const query = searchParams.toString();
    const response = await this.http.get<ListAgentsResponse>(
      `/agents${query ? `?${query}` : ''}`
    );

    return {
      data: response.agents.map(transformAgent),
      total: response.total,
      hasMore: response.offset + response.agents.length < response.total,
      nextOffset: response.offset + response.agents.length < response.total
        ? response.offset + response.limit
        : undefined,
    };
  }

  /**
   * Get an agent by ID
   *
   * @example
   * ```typescript
   * const agent = await veroai.agents.get('agent_123');
   * console.log(`System prompt: ${agent.systemPrompt}`);
   * ```
   */
  async get(agentId: string): Promise<AgentConfig> {
    const response = await this.http.get<{ agent: AgentResponse }>(
      `/agents/${encodeURIComponent(agentId)}`
    );
    return transformAgent(response.agent);
  }

  /**
   * Create a new AI agent
   *
   * @example
   * ```typescript
   * const agent = await veroai.agents.create({
   *   name: 'Support Agent',
   *   modelConfig: {
   *     provider: 'anthropic',
   *     modelId: 'claude-3-5-sonnet-20241022',
   *     temperature: 0.7,
   *   },
   *   systemPrompt: 'You are a helpful support agent...',
   *   enabled: true,
   * });
   * ```
   */
  async create(params: CreateAgentParams): Promise<AgentConfig> {
    const response = await this.http.post<{ agent: AgentResponse }>('/agents', {
      name: params.name,
      description: params.description,
      model_config: {
        provider: params.modelConfig.provider,
        model_id: params.modelConfig.modelId,
        temperature: params.modelConfig.temperature ?? 0.7,
        max_tokens: params.modelConfig.maxTokens ?? 4096,
      },
      system_prompt: params.systemPrompt,
      enabled: params.enabled ?? false,
    });
    return transformAgent(response.agent);
  }

  /**
   * Update an agent
   *
   * @example
   * ```typescript
   * const agent = await veroai.agents.update('agent_123', {
   *   systemPrompt: 'Updated prompt...',
   *   enabled: true,
   * });
   * ```
   */
  async update(agentId: string, params: UpdateAgentParams): Promise<AgentConfig> {
    const body: Record<string, unknown> = {};

    if (params.name !== undefined) body.name = params.name;
    if (params.description !== undefined) body.description = params.description;
    if (params.systemPrompt !== undefined) body.system_prompt = params.systemPrompt;
    if (params.enabled !== undefined) body.enabled = params.enabled;
    if (params.status !== undefined) body.status = params.status;

    if (params.modelConfig) {
      body.model_config = {
        ...(params.modelConfig.provider && { provider: params.modelConfig.provider }),
        ...(params.modelConfig.modelId && { model_id: params.modelConfig.modelId }),
        ...(params.modelConfig.temperature !== undefined && { temperature: params.modelConfig.temperature }),
        ...(params.modelConfig.maxTokens !== undefined && { max_tokens: params.modelConfig.maxTokens }),
      };
    }

    const response = await this.http.patch<{ agent: AgentResponse }>(
      `/agents/${encodeURIComponent(agentId)}`,
      body
    );
    return transformAgent(response.agent);
  }

  /**
   * Delete an agent
   *
   * @example
   * ```typescript
   * await veroai.agents.delete('agent_123');
   * ```
   */
  async delete(agentId: string): Promise<void> {
    await this.http.delete(`/agents/${encodeURIComponent(agentId)}`);
  }

  /**
   * Enable an agent
   *
   * @example
   * ```typescript
   * const agent = await veroai.agents.enable('agent_123');
   * ```
   */
  async enable(agentId: string): Promise<AgentConfig> {
    return this.update(agentId, { enabled: true });
  }

  /**
   * Disable an agent
   *
   * @example
   * ```typescript
   * const agent = await veroai.agents.disable('agent_123');
   * ```
   */
  async disable(agentId: string): Promise<AgentConfig> {
    return this.update(agentId, { enabled: false });
  }
}
