/**
 * Accounts Resource
 *
 * Manage accounts, their tenants, and members.
 * Requires an account-scoped API key.
 */

import type { HttpClient } from '../utils/http';
import type {
  Account,
  AccountMember,
  AccountTenant,
  CreateAccountTenantParams,
  AddAccountMemberParams,
  UpdateAccountMemberParams,
} from '../types';

// API response shapes (snake_case)
interface ApiAccount {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ApiAccountMember {
  id: string;
  account_id: string;
  user_id: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
}

interface ApiTenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function transformAccount(data: ApiAccount): Account {
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    plan: data.plan,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function transformMember(data: ApiAccountMember): AccountMember {
  return {
    id: data.id,
    accountId: data.account_id,
    userId: data.user_id,
    email: data.email,
    role: data.role,
    createdAt: data.created_at,
  };
}

function transformTenant(data: ApiTenant): AccountTenant {
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    plan: data.plan,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export class AccountsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Get the current account details.
   */
  async get(): Promise<Account> {
    const res = await this.http.get<{ account: ApiAccount }>('/v1/accounts/me');
    return transformAccount(res.account);
  }

  // ── Tenants ──────────────────────────────────────────────────────────────

  /**
   * List all tenants in the account.
   */
  async listTenants(): Promise<{ data: AccountTenant[]; total: number }> {
    const res = await this.http.get<{ tenants: ApiTenant[]; total: number }>('/v1/accounts/tenants');
    return {
      data: res.tenants.map(transformTenant),
      total: res.total,
    };
  }

  /**
   * Create a new tenant within the account.
   */
  async createTenant(params: CreateAccountTenantParams): Promise<AccountTenant> {
    const res = await this.http.post<{ tenant: ApiTenant }>('/v1/accounts/tenants', params);
    return transformTenant(res.tenant);
  }

  // ── Members ──────────────────────────────────────────────────────────────

  /**
   * List all members of the account.
   */
  async listMembers(): Promise<{ data: AccountMember[]; total: number }> {
    const res = await this.http.get<{ members: ApiAccountMember[]; total: number }>('/v1/accounts/members');
    return {
      data: res.members.map(transformMember),
      total: res.total,
    };
  }

  /**
   * Add a member to the account.
   */
  async addMember(params: AddAccountMemberParams): Promise<AccountMember> {
    const res = await this.http.post<{ member: ApiAccountMember }>('/v1/accounts/members', {
      user_id: params.userId,
      email: params.email,
      role: params.role,
    });
    return transformMember(res.member);
  }

  /**
   * Update a member's role.
   */
  async updateMember(userId: string, params: UpdateAccountMemberParams): Promise<AccountMember> {
    const res = await this.http.patch<{ member: ApiAccountMember }>(`/v1/accounts/members/${userId}`, params);
    return transformMember(res.member);
  }

  /**
   * Remove a member from the account.
   */
  async removeMember(userId: string): Promise<void> {
    await this.http.delete(`/v1/accounts/members/${userId}`);
  }
}
