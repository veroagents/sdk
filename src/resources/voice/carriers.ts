/**
 * Voice Carriers Resource
 *
 * Manages SIP trunk carrier operations for voice channels
 */

import type { HttpClient } from '../../utils/http';
import type {
  VoiceCarrier,
  VoiceCarrierCreateParams,
  VoiceCarrierUpdateParams,
  ListCarriersParams,
  PredefinedCarrier,
  PaginatedResponse,
  CarrierTrunkType,
  CarrierStatus,
} from '../../types';

// ============================================================================
// API response types (snake_case)
// ============================================================================

interface ApiVoiceCarrier {
  id: string;
  name: string;
  sip_host: string;
  sip_port: number;
  sip_username: string | null;
  sip_register: boolean;
  sip_realm: string | null;
  register_from_user: string | null;
  register_from_domain: string | null;
  e164_leading_plus: boolean;
  trunk_type: CarrierTrunkType;
  status: CarrierStatus;
  jambonz_carrier_sid: string | null;
  created_at: string;
  updated_at: string;
}

interface ApiPredefinedCarrier {
  sid: string;
  name: string;
  description?: string;
  requires_register: boolean;
  e164_leading_plus: boolean;
  register_sip_realm?: string;
}

interface ListCarriersApiResponse {
  carriers: ApiVoiceCarrier[];
  total: number;
  limit: number;
  offset: number;
}

interface CreateCarrierApiResponse {
  carrier: ApiVoiceCarrier;
  message: string;
}

interface UpdateCarrierApiResponse {
  carrier: ApiVoiceCarrier;
}

interface ListPredefinedCarriersApiResponse {
  predefined_carriers: ApiPredefinedCarrier[];
}

interface CreateFromPredefinedApiResponse {
  carrier: ApiVoiceCarrier;
  message: string;
}

// ============================================================================
// Transform functions
// ============================================================================

/**
 * Transform API carrier to SDK carrier
 */
function transformCarrier(data: ApiVoiceCarrier): VoiceCarrier {
  return {
    id: data.id,
    name: data.name,
    sipHost: data.sip_host,
    sipPort: data.sip_port,
    sipUsername: data.sip_username,
    sipRegister: data.sip_register,
    sipRealm: data.sip_realm,
    registerFromUser: data.register_from_user,
    registerFromDomain: data.register_from_domain,
    e164LeadingPlus: data.e164_leading_plus,
    trunkType: data.trunk_type,
    status: data.status,
    jambonzCarrierSid: data.jambonz_carrier_sid,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Transform API predefined carrier to SDK predefined carrier
 */
function transformPredefinedCarrier(data: ApiPredefinedCarrier): PredefinedCarrier {
  return {
    sid: data.sid,
    name: data.name,
    description: data.description,
    requiresRegister: data.requires_register,
    e164LeadingPlus: data.e164_leading_plus,
    registerSipRealm: data.register_sip_realm,
  };
}

// ============================================================================
// Resource class
// ============================================================================

export class VoiceCarriersResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List voice carriers
   */
  async list(params?: ListCarriersParams): Promise<PaginatedResponse<VoiceCarrier>> {
    const response = await this.http.get<ListCarriersApiResponse>('/v1/voice/carriers', {
      trunk_type: params?.trunkType,
      status: params?.status,
      limit: params?.limit,
      offset: params?.offset,
    });
    return {
      data: response.carriers.map(transformCarrier),
      total: response.total,
      hasMore: (response.offset + response.carriers.length) < response.total,
      nextOffset: response.offset + response.carriers.length,
    };
  }

  /**
   * Get a voice carrier by ID
   */
  async get(carrierId: string): Promise<VoiceCarrier> {
    const response = await this.http.get<ApiVoiceCarrier>(`/v1/voice/carriers/${carrierId}`);
    return transformCarrier(response);
  }

  /**
   * Create a new voice carrier
   */
  async create(params: VoiceCarrierCreateParams): Promise<VoiceCarrier> {
    const response = await this.http.post<CreateCarrierApiResponse>('/v1/voice/carriers', {
      name: params.name,
      sip_host: params.sipHost,
      sip_port: params.sipPort,
      sip_username: params.sipUsername,
      sip_password: params.sipPassword,
      sip_register: params.sipRegister,
      sip_realm: params.sipRealm,
      register_from_user: params.registerFromUser,
      register_from_domain: params.registerFromDomain,
      e164_leading_plus: params.e164LeadingPlus,
      trunk_type: params.trunkType,
    });
    return transformCarrier(response.carrier);
  }

  /**
   * Update a voice carrier
   */
  async update(carrierId: string, params: VoiceCarrierUpdateParams): Promise<VoiceCarrier> {
    const response = await this.http.patch<UpdateCarrierApiResponse>(`/v1/voice/carriers/${carrierId}`, {
      name: params.name,
      sip_host: params.sipHost,
      sip_port: params.sipPort,
      sip_username: params.sipUsername,
      sip_password: params.sipPassword,
      sip_register: params.sipRegister,
      sip_realm: params.sipRealm,
      register_from_user: params.registerFromUser,
      register_from_domain: params.registerFromDomain,
      e164_leading_plus: params.e164LeadingPlus,
      trunk_type: params.trunkType,
      status: params.status,
    });
    return transformCarrier(response.carrier);
  }

  /**
   * Delete a voice carrier
   */
  async delete(carrierId: string): Promise<void> {
    await this.http.delete(`/v1/voice/carriers/${carrierId}`);
  }

  /**
   * List predefined carrier templates
   */
  async listPredefined(): Promise<PredefinedCarrier[]> {
    const response = await this.http.get<ListPredefinedCarriersApiResponse>('/v1/voice/carriers/predefined');
    return response.predefined_carriers.map(transformPredefinedCarrier);
  }

  /**
   * Create a carrier from a predefined template
   */
  async createFromPredefined(predefinedSid: string): Promise<VoiceCarrier> {
    const response = await this.http.post<CreateFromPredefinedApiResponse>(`/v1/voice/carriers/predefined/${predefinedSid}`);
    return transformCarrier(response.carrier);
  }
}
