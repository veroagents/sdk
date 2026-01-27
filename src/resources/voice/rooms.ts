/**
 * Voice Rooms Resource
 *
 * LiveKit WebRTC room management for browser-based voice/video calls
 */

import type { HttpClient } from '../../utils/http';
import type {
  CreateRoomParams,
  JoinRoomParams,
  LiveKitRoomInfo,
  LiveKitRoom,
  LiveKitParticipant,
  ListRoomsParams,
} from '../../types';

// API response types (snake_case from server)
interface CreateRoomResponse {
  room: {
    id: string;
    name: string;
    display_name: string;
    channel_id: string | null;
    empty_timeout: number;
    max_participants: number;
    ws_url: string;
    token: string;
    created_at: string;
  };
  message: string;
}

interface JoinRoomResponse {
  room_name: string;
  ws_url: string;
  token: string;
  participant: {
    identity: string;
    name: string;
    can_publish: boolean;
    can_subscribe: boolean;
  };
}

interface ListRoomsResponse {
  rooms: Array<{
    name: string;
    ws_url: string;
  }>;
  total: number;
  limit: number;
  offset: number;
}

interface GetRoomResponse {
  room: {
    name: string;
    ws_url: string;
  };
}

export class VoiceRoomsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a new WebRTC room
   *
   * @example
   * ```typescript
   * const roomInfo = await veroai.voice.rooms.create({
   *   name: 'support-call-123',
   *   emptyTimeout: 300,
   *   maxParticipants: 2,
   * });
   * // Connect to room using roomInfo.wsUrl and roomInfo.token
   * ```
   */
  async create(params: CreateRoomParams): Promise<LiveKitRoomInfo> {
    const response = await this.http.post<CreateRoomResponse>('/voice/rooms', {
      name: params.name,
      empty_timeout: params.emptyTimeout,
      max_participants: params.maxParticipants,
      metadata: params.metadata,
    });

    return {
      sid: response.room.id,
      name: response.room.name,
      wsUrl: response.room.ws_url,
      token: response.room.token,
      numParticipants: 0,
      metadata: params.metadata,
    };
  }

  /**
   * Join an existing room or create and join if it doesn't exist
   *
   * @example
   * ```typescript
   * const roomInfo = await veroai.voice.rooms.join({
   *   roomName: 'support-call-123',
   *   participantName: 'Agent Smith',
   * });
   * // Use roomInfo.token to connect via LiveKit client SDK
   * ```
   */
  async join(params: JoinRoomParams): Promise<LiveKitRoomInfo> {
    const response = await this.http.post<JoinRoomResponse>(
      `/voice/rooms/${encodeURIComponent(params.roomName)}/join`,
      {
        participant_name: params.participantName,
        can_publish: params.canPublish,
        can_subscribe: params.canSubscribe,
        metadata: params.metadata,
      }
    );

    return {
      sid: '',
      name: response.room_name,
      wsUrl: response.ws_url,
      token: response.token,
      numParticipants: 0,
    };
  }

  /**
   * Get room details
   *
   * @example
   * ```typescript
   * const room = await veroai.voice.rooms.get('support-call-123');
   * console.log(`Room: ${room.name}`);
   * ```
   */
  async get(roomName: string): Promise<LiveKitRoom> {
    const response = await this.http.get<GetRoomResponse>(
      `/voice/rooms/${encodeURIComponent(roomName)}`
    );

    return {
      sid: '',
      name: response.room.name,
      emptyTimeout: 300,
      maxParticipants: 10,
      creationTime: '',
      numParticipants: 0,
    };
  }

  /**
   * List all active rooms
   *
   * @example
   * ```typescript
   * const rooms = await veroai.voice.rooms.list();
   * for (const room of rooms) {
   *   console.log(`${room.name}`);
   * }
   * ```
   */
  async list(params?: ListRoomsParams): Promise<LiveKitRoom[]> {
    const searchParams = new URLSearchParams();
    if (params?.names) {
      for (const name of params.names) {
        searchParams.append('names', name);
      }
    }
    const query = searchParams.toString();
    const response = await this.http.get<ListRoomsResponse>(
      `/voice/rooms${query ? `?${query}` : ''}`
    );

    return response.rooms.map((room) => ({
      sid: '',
      name: room.name,
      emptyTimeout: 300,
      maxParticipants: 10,
      creationTime: '',
      numParticipants: 0,
    }));
  }

  /**
   * Delete a room and disconnect all participants
   *
   * @example
   * ```typescript
   * await veroai.voice.rooms.delete('support-call-123');
   * ```
   */
  async delete(roomName: string): Promise<void> {
    await this.http.delete(`/voice/rooms/${encodeURIComponent(roomName)}`);
  }

  /**
   * List participants in a room
   *
   * @example
   * ```typescript
   * const participants = await veroai.voice.rooms.listParticipants('support-call-123');
   * for (const p of participants) {
   *   console.log(`${p.name} (${p.state})`);
   * }
   * ```
   */
  async listParticipants(roomName: string): Promise<LiveKitParticipant[]> {
    return this.http.get<LiveKitParticipant[]>(
      `/voice/rooms/${encodeURIComponent(roomName)}/participants`
    );
  }

  /**
   * Remove a participant from a room
   *
   * @example
   * ```typescript
   * await veroai.voice.rooms.removeParticipant('support-call-123', 'user-456');
   * ```
   */
  async removeParticipant(roomName: string, identity: string): Promise<void> {
    await this.http.delete(
      `/voice/rooms/${encodeURIComponent(roomName)}/participants/${encodeURIComponent(identity)}`
    );
  }

  /**
   * Mute or unmute a participant's audio
   *
   * @example
   * ```typescript
   * // Mute participant
   * await veroai.voice.rooms.muteParticipant('support-call-123', 'user-456', true);
   *
   * // Unmute participant
   * await veroai.voice.rooms.muteParticipant('support-call-123', 'user-456', false);
   * ```
   */
  async muteParticipant(roomName: string, identity: string, muted: boolean): Promise<void> {
    await this.http.post(
      `/voice/rooms/${encodeURIComponent(roomName)}/participants/${encodeURIComponent(identity)}/mute`,
      { muted }
    );
  }

  /**
   * Send a data message to participants in a room
   *
   * @example
   * ```typescript
   * // Send to all participants
   * await veroai.voice.rooms.sendData('support-call-123', { type: 'notification', message: 'Recording started' });
   *
   * // Send to specific participants
   * await veroai.voice.rooms.sendData('support-call-123', { type: 'private' }, ['user-456']);
   * ```
   */
  async sendData(
    roomName: string,
    data: Record<string, unknown>,
    destinationIdentities?: string[]
  ): Promise<void> {
    await this.http.post(`/voice/rooms/${encodeURIComponent(roomName)}/data`, {
      data,
      destinationIdentities,
    });
  }
}
