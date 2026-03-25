/**
 * Teams Resource
 *
 * Manage agent teams via the agentsrv REST API (proxied through api.veroagents.com)
 */

import type { HttpClient } from '../utils/http';
import type { Team, TeamMember, ListTeamsParams } from '../types';

// Server response (snake_case from agentsrv)
interface TeamServerResponse {
  id: string;
  name: string;
  description: string;
  tenant_id: string;
  sandcastle_id: string;
  vm_status: string;
  created_at: string;
  members: TeamMemberServerResponse[];
}

interface TeamMemberServerResponse {
  agent_id: string;
  display_name: string;
  avatar_url: string;
  job_title: string;
  role: string;
  created_at: string;
}

function transformMember(m: TeamMemberServerResponse): TeamMember {
  return {
    agentId: m.agent_id,
    displayName: m.display_name,
    avatarUrl: m.avatar_url || undefined,
    jobTitle: m.job_title || undefined,
    role: m.role,
    createdAt: m.created_at,
  };
}

function transformTeam(t: TeamServerResponse): Team {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    tenantId: t.tenant_id,
    sandcastleId: t.sandcastle_id || undefined,
    vmStatus: t.vm_status,
    createdAt: t.created_at,
    members: (t.members || []).map(transformMember),
  };
}

export class TeamsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List all teams for the current tenant
   *
   * @example
   * ```typescript
   * const { teams } = await veroai.teams.list();
   * ```
   */
  async list(_params?: ListTeamsParams): Promise<{ teams: Team[] }> {
    const response = await this.http.get<{ teams: TeamServerResponse[] }>('/v1/teams');
    return {
      teams: (response.teams || []).map(transformTeam),
    };
  }

  /**
   * Get a single team by ID
   *
   * @example
   * ```typescript
   * const team = await veroai.teams.get('team-uuid');
   * ```
   */
  async get(teamId: string): Promise<Team> {
    const response = await this.http.get<TeamServerResponse>(
      `/v1/teams/${encodeURIComponent(teamId)}`,
    );
    return transformTeam(response);
  }
}
