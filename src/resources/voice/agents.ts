/**
 * Voice Agents Resource
 *
 * Manages wiring between AI agents and voice resources (phone numbers, channels).
 */

import type { HttpClient } from '../../utils/http';

// ============================================================================
// API response types (snake_case)
// ============================================================================

interface ApiVoiceAgentChannel {
  channel_id: string;
  channel_name: string;
  jambonz_application_sid: string | null;
}

interface ApiVoiceAgentNumber {
  id: string;
  number: string;
  country: string;
}

interface ApiVoiceAgent {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  enabled: boolean;
  status: string;
  voice_channels: ApiVoiceAgentChannel[];
  phone_numbers: ApiVoiceAgentNumber[];
  is_voice_wired: boolean;
}

interface ListVoiceAgentsApiResponse {
  agents: ApiVoiceAgent[];
}

interface WireApiResponse {
  message: string;
  channel_id: string;
  phone_number: string;
  agent_name: string;
  jambonz_application_sid: string | null;
}

interface UnwireApiResponse {
  message: string;
}

// ============================================================================
// Public types
// ============================================================================

export interface VoiceAgentChannel {
  channelId: string;
  channelName: string;
  jambonzApplicationSid: string | null;
}

export interface VoiceAgentNumber {
  id: string;
  number: string;
  country: string;
}

export interface VoiceAgentStatus {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  enabled: boolean;
  status: string;
  voiceChannels: VoiceAgentChannel[];
  phoneNumbers: VoiceAgentNumber[];
  isVoiceWired: boolean;
}

export interface WireAgentParams {
  agentId: string;
  phoneNumberId: string;
  channelName?: string;
}

export interface WireAgentResult {
  channelId: string;
  phoneNumber: string;
  agentName: string;
  jambonzApplicationSid: string | null;
}

export interface UnwireAgentParams {
  agentId: string;
  phoneNumberId: string;
}

// ============================================================================
// Transform functions
// ============================================================================

function transformVoiceAgent(data: ApiVoiceAgent): VoiceAgentStatus {
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    avatar: data.avatar,
    enabled: data.enabled,
    status: data.status,
    voiceChannels: data.voice_channels.map(ch => ({
      channelId: ch.channel_id,
      channelName: ch.channel_name,
      jambonzApplicationSid: ch.jambonz_application_sid,
    })),
    phoneNumbers: data.phone_numbers.map(num => ({
      id: num.id,
      number: num.number,
      country: num.country,
    })),
    isVoiceWired: data.is_voice_wired,
  };
}

// ============================================================================
// Resource class
// ============================================================================

export class VoiceAgentsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List all agents with their voice wiring status
   */
  async list(): Promise<VoiceAgentStatus[]> {
    const response = await this.http.get<ListVoiceAgentsApiResponse>('/v1/voice/agents');
    return response.agents.map(transformVoiceAgent);
  }

  /**
   * Wire an agent to a phone number for inbound voice calls.
   * Auto-creates voice channel and Jambonz application if needed.
   */
  async wire(params: WireAgentParams): Promise<WireAgentResult> {
    const response = await this.http.post<WireApiResponse>('/v1/voice/agents/wire', {
      agent_id: params.agentId,
      phone_number_id: params.phoneNumberId,
      channel_name: params.channelName,
    });
    return {
      channelId: response.channel_id,
      phoneNumber: response.phone_number,
      agentName: response.agent_name,
      jambonzApplicationSid: response.jambonz_application_sid,
    };
  }

  /**
   * Unwire an agent from a phone number
   */
  async unwire(params: UnwireAgentParams): Promise<void> {
    await this.http.post<UnwireApiResponse>('/v1/voice/agents/unwire', {
      agent_id: params.agentId,
      phone_number_id: params.phoneNumberId,
    });
  }
}
