/**
 * Sandcastle Resource
 *
 * Firecracker microVMs for isolated agent execution. ~125 ms cold boot.
 * Per-agent isolation, MMDS secret injection, MCP server on :3000, REST API on :8080.
 */

import type { HttpClient } from '../utils/http';
import type {
  CreateSandcastleParams,
  ListSandcastlesParams,
  SandcastleExecParams,
  SandcastleExecResult,
  SandcastleImage,
  SandcastleStatus,
  SandcastleVm,
} from '../types';

interface SandcastleServerResponse {
  id: string;
  image: SandcastleImage;
  status: SandcastleStatus;
  agent_id?: string;
  mcp_endpoint: string;
  api_endpoint: string;
  ip_address: string;
  vcpus: number;
  memory_mb: number;
  boot_ms?: number;
  created_at: string;
  started_at?: string;
  stopped_at?: string;
  idle_ttl?: number;
  max_lifetime?: number;
}

function transformVm(v: SandcastleServerResponse): SandcastleVm {
  return {
    id: v.id,
    image: v.image,
    status: v.status,
    agentId: v.agent_id,
    mcpEndpoint: v.mcp_endpoint,
    apiEndpoint: v.api_endpoint,
    ipAddress: v.ip_address,
    vcpus: v.vcpus,
    memoryMb: v.memory_mb,
    bootMs: v.boot_ms,
    createdAt: v.created_at,
    startedAt: v.started_at,
    stoppedAt: v.stopped_at,
    idleTtl: v.idle_ttl,
    maxLifetime: v.max_lifetime,
  };
}

export class SandcastleResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create (and boot) a new Sandcastle VM. Resolves once the VM is ready to accept
   * MCP calls — typically ~125 ms cold boot.
   *
   * @example
   * ```typescript
   * const vm = await veroai.sandcastle.create({
   *   image: 'dev-machine',
   *   agentId: 'researcher-01',
   *   secrets: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY! },
   *   idleTtl: 300,
   * });
   * console.log(vm.mcpEndpoint);
   * ```
   */
  async create(params: CreateSandcastleParams): Promise<SandcastleVm> {
    const body: Record<string, unknown> = { image: params.image };
    if (params.agentId !== undefined) body.agent_id = params.agentId;
    if (params.secrets !== undefined) body.secrets = params.secrets;
    if (params.env !== undefined) body.env = params.env;
    if (params.vcpus !== undefined) body.vcpus = params.vcpus;
    if (params.memoryMb !== undefined) body.memory_mb = params.memoryMb;
    if (params.idleTtl !== undefined) body.idle_ttl = params.idleTtl;
    if (params.maxLifetime !== undefined) body.max_lifetime = params.maxLifetime;

    const response = await this.http.post<SandcastleServerResponse>(
      '/v1/sandcastle',
      body,
    );
    return transformVm(response);
  }

  /**
   * List VMs
   */
  async list(params?: ListSandcastlesParams): Promise<{ vms: SandcastleVm[] }> {
    const query: Record<string, string> = {};
    if (params?.status) query.status = params.status;
    if (params?.agentId) query.agent_id = params.agentId;
    if (params?.limit !== undefined) query.limit = String(params.limit);
    if (params?.offset !== undefined) query.offset = String(params.offset);

    const response = await this.http.get<{ vms: SandcastleServerResponse[] }>(
      '/v1/sandcastle',
      query,
    );
    return { vms: (response.vms || []).map(transformVm) };
  }

  /**
   * Get VM metadata
   */
  async get(vmId: string): Promise<SandcastleVm> {
    const response = await this.http.get<SandcastleServerResponse>(
      `/v1/sandcastle/${encodeURIComponent(vmId)}`,
    );
    return transformVm(response);
  }

  /**
   * Destroy a VM. Disk + network + MMDS metadata are discarded.
   */
  async destroy(vmId: string): Promise<void> {
    await this.http.delete(`/v1/sandcastle/${encodeURIComponent(vmId)}`);
  }

  /**
   * Run a shell command inside the VM and return stdout/stderr/exit.
   * For streaming or long-lived processes, connect directly to the VM's MCP
   * or REST endpoint instead.
   *
   * @example
   * ```typescript
   * const r = await veroai.sandcastle.exec(vm.id, { command: 'node -v' });
   * console.log(r.stdout.trim()); // v20.11.0
   * ```
   */
  async exec(vmId: string, params: SandcastleExecParams): Promise<SandcastleExecResult> {
    const body: Record<string, unknown> = { command: params.command };
    if (params.cwd !== undefined) body.cwd = params.cwd;
    if (params.env !== undefined) body.env = params.env;
    if (params.timeout !== undefined) body.timeout = params.timeout;

    const response = await this.http.post<{
      exit_code: number;
      stdout: string;
      stderr: string;
      duration_ms: number;
    }>(`/v1/sandcastle/${encodeURIComponent(vmId)}/exec`, body);
    return {
      exitCode: response.exit_code,
      stdout: response.stdout,
      stderr: response.stderr,
      durationMs: response.duration_ms,
    };
  }
}
