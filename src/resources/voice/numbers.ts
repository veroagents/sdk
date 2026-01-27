/**
 * Voice Numbers Resource
 *
 * Manages phone number operations for voice channels
 */

import type { HttpClient } from '../../utils/http';
import type {
  PhoneNumber,
  AvailableNumber,
  SearchNumbersParams,
  PurchaseNumberParams,
  UpdateNumberParams,
  ListNumbersParams,
  PaginatedResponse,
} from '../../types';

// API response types (snake_case)
interface ApiPhoneNumber {
  id: string;
  number: string;
  country: string;
  region: string | null;
  locality: string | null;
  capabilities: string[];
  channel_id: string | null;
  channel_name?: string | null;
  status: string;
  monthly_cost_cents: number | null;
  setup_cost_cents: number | null;
  created_at: string;
  updated_at: string;
}

interface ApiAvailableNumber {
  number: string;
  country: string;
  region: string | null;
  locality: string | null;
  capabilities: string[];
  monthly_cost_cents: number;
  setup_cost_cents: number;
  provider: string;
}

interface ListNumbersApiResponse {
  numbers: ApiPhoneNumber[];
  total: number;
  limit: number;
  offset: number;
}

interface SearchNumbersApiResponse {
  available_numbers: ApiAvailableNumber[];
  total: number;
  search_params: Record<string, unknown>;
}

interface PurchaseNumberApiResponse {
  number: ApiPhoneNumber;
  message: string;
}

interface UpdateNumberApiResponse {
  number: ApiPhoneNumber;
}

/**
 * Transform API phone number to SDK phone number
 */
function transformPhoneNumber(data: ApiPhoneNumber): PhoneNumber {
  return {
    id: data.id,
    number: data.number,
    country: data.country,
    region: data.region,
    locality: data.locality,
    capabilities: data.capabilities as PhoneNumber['capabilities'],
    channelId: data.channel_id,
    channelName: data.channel_name,
    status: data.status as PhoneNumber['status'],
    monthlyCostCents: data.monthly_cost_cents,
    setupCostCents: data.setup_cost_cents,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Transform API available number to SDK available number
 */
function transformAvailableNumber(data: ApiAvailableNumber): AvailableNumber {
  return {
    number: data.number,
    country: data.country,
    region: data.region,
    locality: data.locality,
    capabilities: data.capabilities as AvailableNumber['capabilities'],
    monthlyCostCents: data.monthly_cost_cents,
    setupCostCents: data.setup_cost_cents,
    provider: data.provider,
  };
}

export class VoiceNumbersResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Search for available phone numbers to purchase
   */
  async search(params: SearchNumbersParams): Promise<AvailableNumber[]> {
    const response = await this.http.get<SearchNumbersApiResponse>('/v1/voice/numbers/search', {
      country: params.country,
      area_code: params.areaCode,
      contains: params.contains,
      capabilities: params.capabilities?.join(','),
      limit: params.limit,
    });
    return response.available_numbers.map(transformAvailableNumber);
  }

  /**
   * Purchase a phone number
   */
  async purchase(params: PurchaseNumberParams): Promise<PhoneNumber> {
    const response = await this.http.post<PurchaseNumberApiResponse>('/v1/voice/numbers/purchase', {
      number: params.number,
      channel_id: params.channelId,
    });
    return transformPhoneNumber(response.number);
  }

  /**
   * List owned phone numbers
   */
  async list(params?: ListNumbersParams): Promise<PaginatedResponse<PhoneNumber>> {
    const response = await this.http.get<ListNumbersApiResponse>('/v1/voice/numbers', {
      channel_id: params?.channelId,
      status: params?.status,
      country: params?.country,
      capabilities: params?.capabilities?.join(','),
      limit: params?.limit,
      offset: params?.offset,
    });
    return {
      data: response.numbers.map(transformPhoneNumber),
      total: response.total,
      hasMore: (response.offset + response.numbers.length) < response.total,
      nextOffset: response.offset + response.numbers.length,
    };
  }

  /**
   * Get a phone number by ID
   */
  async get(numberId: string): Promise<PhoneNumber> {
    const response = await this.http.get<ApiPhoneNumber>(`/v1/voice/numbers/${numberId}`);
    return transformPhoneNumber(response);
  }

  /**
   * Update a phone number (assign/unassign to channel)
   */
  async update(numberId: string, params: UpdateNumberParams): Promise<PhoneNumber> {
    const response = await this.http.patch<UpdateNumberApiResponse>(`/v1/voice/numbers/${numberId}`, {
      channel_id: params.channelId,
    });
    return transformPhoneNumber(response.number);
  }

  /**
   * Release a phone number
   */
  async release(numberId: string): Promise<void> {
    await this.http.delete(`/v1/voice/numbers/${numberId}`);
  }

  /**
   * Assign a phone number to a channel
   */
  async assignToChannel(numberId: string, channelId: string): Promise<PhoneNumber> {
    return this.update(numberId, { channelId });
  }

  /**
   * Unassign a phone number from its channel
   */
  async unassignFromChannel(numberId: string): Promise<PhoneNumber> {
    return this.update(numberId, { channelId: null });
  }
}
