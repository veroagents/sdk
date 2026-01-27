/**
 * Domains Resource
 */

import type { HttpClient } from '../utils/http';
import type {
  Domain,
  CreateDomainParams,
  VerifyDomainResult,
  PaginatedResponse,
} from '../types';

interface ApiDomain {
  id: string;
  tenant_id: string;
  domain: string;
  status: string;
  verification_record: string | null;
  verification_status: {
    dkim: boolean;
    spf: boolean;
    dmarc: boolean;
    mx: boolean;
    last_checked_at?: string | null;
  };
  dns_records: Array<{
    type: string;
    name: string;
    value: string;
    priority?: number;
    verified: boolean;
  }>;
  created_at: string;
  updated_at: string;
}

interface ListDomainsApiResponse {
  domains: ApiDomain[];
  total: number;
}

interface CreateDomainApiResponse {
  domain: ApiDomain;
  verification_record?: {
    type: string;
    name: string;
    value: string;
  };
}

interface VerifyDomainApiResponse {
  domain: ApiDomain;
  verification_results: {
    dkim: { verified: boolean; error?: string };
    spf: { verified: boolean; error?: string };
    dmarc: { verified: boolean; error?: string };
    mx: { verified: boolean; error?: string };
  };
}

function transformDomain(data: ApiDomain): Domain {
  return {
    id: data.id,
    tenantId: data.tenant_id,
    domain: data.domain,
    status: data.status as Domain['status'],
    verificationRecord: data.verification_record,
    verificationStatus: {
      dkim: data.verification_status.dkim,
      spf: data.verification_status.spf,
      dmarc: data.verification_status.dmarc,
      mx: data.verification_status.mx,
      lastCheckedAt: data.verification_status.last_checked_at,
    },
    dnsRecords: data.dns_records.map(record => ({
      type: record.type as 'MX' | 'TXT' | 'CNAME',
      name: record.name,
      value: record.value,
      priority: record.priority,
      verified: record.verified,
    })),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export class DomainsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List all domains
   */
  async list(): Promise<PaginatedResponse<Domain>> {
    const response = await this.http.get<ListDomainsApiResponse>('/v1/domains');
    return {
      data: response.domains.map(transformDomain),
      total: response.total,
      hasMore: false,
    };
  }

  /**
   * Get a domain by ID
   */
  async get(domainId: string): Promise<Domain> {
    const response = await this.http.get<{ domain: ApiDomain }>(`/v1/domains/${domainId}`);
    return transformDomain(response.domain);
  }

  /**
   * Add a new domain
   *
   * @example
   * ```typescript
   * // Manual DNS verification
   * const { domain } = await veroai.domains.create({
   *   domain: 'example.com',
   *   verificationMethod: 'manual',
   * });
   *
   * // Automatic via Cloudflare
   * const { domain } = await veroai.domains.create({
   *   domain: 'example.com',
   *   verificationMethod: 'cloudflare',
   *   cloudflareApiToken: 'your_cf_token',
   * });
   * ```
   */
  async create(params: CreateDomainParams): Promise<{ domain: Domain; verificationRecord?: { type: string; name: string; value: string } }> {
    const response = await this.http.post<CreateDomainApiResponse>('/v1/domains', {
      domain: params.domain,
      verification_method: params.verificationMethod,
      cloudflare_api_token: params.cloudflareApiToken,
    });
    return {
      domain: transformDomain(response.domain),
      verificationRecord: response.verification_record,
    };
  }

  /**
   * Delete a domain
   */
  async delete(domainId: string): Promise<void> {
    await this.http.delete(`/v1/domains/${domainId}`);
  }

  /**
   * Verify domain DNS records
   */
  async verify(domainId: string): Promise<VerifyDomainResult> {
    const response = await this.http.post<VerifyDomainApiResponse>(
      `/v1/domains/${domainId}/verify`
    );
    return {
      domain: transformDomain(response.domain),
      verificationResults: response.verification_results,
    };
  }

  /**
   * Get DNS records that need to be configured
   */
  async dnsRecords(domainId: string): Promise<Domain['dnsRecords']> {
    const domain = await this.get(domainId);
    return domain.dnsRecords;
  }
}
