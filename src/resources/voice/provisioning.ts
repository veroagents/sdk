/**
 * Voice Provisioning Resource
 *
 * Manages Jambonz account provisioning for tenants.
 */

import type { HttpClient } from '../../utils/http';

// ============================================================================
// API response types
// ============================================================================

interface JambonzStatusApiResponse {
  provisioned: boolean;
  jambonz_account_sid: string | null;
  has_api_key: boolean;
}

interface ProvisionJambonzApiResponse {
  provisioned: boolean;
  jambonz_account_sid: string;
  message: string;
}

// ============================================================================
// Public types
// ============================================================================

export interface JambonzProvisioningStatus {
  provisioned: boolean;
  jambonzAccountSid: string | null;
  hasApiKey: boolean;
}

export interface ProvisionJambonzResult {
  provisioned: boolean;
  jambonzAccountSid: string;
}

// ============================================================================
// Resource class
// ============================================================================

export class VoiceProvisioningResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Check if the tenant has a Jambonz account provisioned
   */
  async getJambonzStatus(): Promise<JambonzProvisioningStatus> {
    const response = await this.http.get<JambonzStatusApiResponse>('/v1/voice/provisioning/jambonz');
    return {
      provisioned: response.provisioned,
      jambonzAccountSid: response.jambonz_account_sid,
      hasApiKey: response.has_api_key,
    };
  }

  /**
   * Provision a Jambonz account for the tenant. Idempotent — returns existing account if already provisioned.
   */
  async provisionJambonz(): Promise<ProvisionJambonzResult> {
    const response = await this.http.post<ProvisionJambonzApiResponse>('/v1/voice/provisioning/jambonz');
    return {
      provisioned: response.provisioned,
      jambonzAccountSid: response.jambonz_account_sid,
    };
  }
}
