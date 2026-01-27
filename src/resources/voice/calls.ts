/**
 * Voice Calls Resource
 *
 * Manages voice call operations
 */

import type { HttpClient } from '../../utils/http';
import type {
  Call,
  DialParams,
  ListCallsParams,
  PaginatedResponse,
} from '../../types';

// API response types (snake_case)
interface ApiCall {
  id: string;
  channel_id: string;
  provider_call_sid: string;
  from_number: string;
  to_number: string;
  direction: string;
  status: string;
  end_reason: string | null;
  initiated_at: string;
  ringing_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  transcription_url: string | null;
  agent_id: string | null;
  metadata: Record<string, unknown> | null;
}

interface ListCallsApiResponse {
  calls: ApiCall[];
  total: number;
  limit: number;
  offset: number;
}

interface DialCallApiResponse {
  call: ApiCall;
  message: string;
}

interface HangupCallApiResponse {
  message: string;
  call_id: string;
  previous_status: string;
}

/**
 * Transform API call to SDK call
 */
function transformCall(data: ApiCall): Call {
  return {
    id: data.id,
    channelId: data.channel_id,
    providerCallSid: data.provider_call_sid,
    fromNumber: data.from_number,
    toNumber: data.to_number,
    direction: data.direction as Call['direction'],
    status: data.status as Call['status'],
    endReason: data.end_reason as Call['endReason'],
    initiatedAt: data.initiated_at,
    ringingAt: data.ringing_at,
    answeredAt: data.answered_at,
    endedAt: data.ended_at,
    durationSeconds: data.duration_seconds,
    recordingUrl: data.recording_url,
    transcriptionUrl: data.transcription_url,
    agentId: data.agent_id,
    metadata: data.metadata,
  };
}

export class VoiceCallsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Initiate an outbound call
   */
  async dial(params: DialParams): Promise<Call> {
    const response = await this.http.post<DialCallApiResponse>('/v1/voice/calls', {
      channel_id: params.channelId,
      to: params.to,
      from: params.from,
      timeout: params.timeout,
      metadata: params.metadata,
    });
    return transformCall(response.call);
  }

  /**
   * List calls
   */
  async list(params?: ListCallsParams): Promise<PaginatedResponse<Call>> {
    const response = await this.http.get<ListCallsApiResponse>('/v1/voice/calls', {
      channel_id: params?.channelId,
      direction: params?.direction,
      status: params?.status,
      from_number: params?.fromNumber,
      to_number: params?.toNumber,
      start_date: params?.startDate instanceof Date ? params.startDate.toISOString() : params?.startDate,
      end_date: params?.endDate instanceof Date ? params.endDate.toISOString() : params?.endDate,
      limit: params?.limit,
      offset: params?.offset,
    });
    return {
      data: response.calls.map(transformCall),
      total: response.total,
      hasMore: (response.offset + response.calls.length) < response.total,
      nextOffset: response.offset + response.calls.length,
    };
  }

  /**
   * Get a call by ID
   */
  async get(callId: string): Promise<Call> {
    const response = await this.http.get<ApiCall>(`/v1/voice/calls/${callId}`);
    return transformCall(response);
  }

  /**
   * Hang up an active call
   */
  async hangup(callId: string): Promise<void> {
    await this.http.post<HangupCallApiResponse>(`/v1/voice/calls/${callId}/hangup`);
  }
}
