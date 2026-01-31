/**
 * Chat Resources
 *
 * Conversations, messages, participants, and user presence management
 */

import type { HttpClient } from '../utils/http';
import type {
  Conversation,
  ConversationParticipant,
  ChatMessage,
  ChatUser,
  ChatUserWithPresence,
  CreateConversationParams,
  SendChatMessageParams,
  ListMessagesParams,
  MessagesResponse,
  AddAgentParams,
  ConversationAgent,
  UserPresence,
  UpdatePresenceParams,
  ListUsersParams,
  PaginatedResponse,
} from '../types';

// ============================================================================
// API Response Types (snake_case from server)
// ============================================================================

interface ApiChatUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_virtual: boolean;
  agent_config_id?: string | null;
}

interface ApiChatUserWithPresence extends ApiChatUser {
  status: string;
  status_message: string | null;
  last_seen: string | null;
  created_at: string;
}

interface ApiParticipant {
  user_id: string;
  role: string;
  is_active: boolean;
  joined_at: string;
  last_seen?: string | null;
  user?: ApiChatUser;
}

interface ApiMessageRead {
  user_id: string;
  read_at: string;
}

interface ApiMessage {
  id: string;
  conversation_id: string;
  content: string;
  message_type: string;
  sender_id: string;
  sender?: ApiChatUser;
  read_by?: ApiMessageRead[];
  metadata?: Record<string, unknown>;
  created_at: string;
  edited_at?: string | null;
}

interface ApiConversation {
  id: string;
  name: string | null;
  type: string;
  is_active: boolean;
  last_message_at: string | null;
  agent_enabled: boolean;
  agent_config_id: string | null;
  participants?: ApiParticipant[];
  unread_count: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

interface ApiPresence {
  user_id: string;
  status: string;
  status_message: string | null;
  last_seen: string | null;
  metadata?: Record<string, unknown>;
}

interface ApiAgent {
  config_id: string;
  name: string;
  user_id: string | null;
  enabled: boolean;
}

// ============================================================================
// Transform Functions
// ============================================================================

function transformUser(data: ApiChatUser): ChatUser {
  return {
    id: data.id,
    email: data.email,
    firstName: data.first_name,
    lastName: data.last_name,
    isVirtual: data.is_virtual,
    agentConfigId: data.agent_config_id,
  };
}

function transformUserWithPresence(data: ApiChatUserWithPresence): ChatUserWithPresence {
  return {
    ...transformUser(data),
    status: data.status as ChatUserWithPresence['status'],
    statusMessage: data.status_message,
    lastSeen: data.last_seen,
    createdAt: data.created_at,
  };
}

function transformParticipant(data: ApiParticipant): ConversationParticipant {
  return {
    userId: data.user_id,
    role: data.role as ConversationParticipant['role'],
    isActive: data.is_active,
    joinedAt: data.joined_at,
    lastSeen: data.last_seen,
    user: data.user ? transformUser(data.user) : undefined,
  };
}

function transformMessage(data: ApiMessage): ChatMessage {
  return {
    id: data.id,
    conversationId: data.conversation_id,
    content: data.content,
    messageType: data.message_type as ChatMessage['messageType'],
    senderId: data.sender_id,
    sender: data.sender ? transformUser(data.sender) : undefined,
    readBy: data.read_by?.map((r) => ({
      userId: r.user_id,
      readAt: r.read_at,
    })),
    metadata: data.metadata,
    createdAt: data.created_at,
    editedAt: data.edited_at,
  };
}

function transformConversation(data: ApiConversation): Conversation {
  return {
    id: data.id,
    name: data.name,
    type: data.type as Conversation['type'],
    isActive: data.is_active,
    lastMessageAt: data.last_message_at,
    agentEnabled: data.agent_enabled,
    agentConfigId: data.agent_config_id,
    participants: data.participants?.map(transformParticipant),
    unreadCount: data.unread_count,
    metadata: data.metadata,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function transformPresence(data: ApiPresence): UserPresence {
  return {
    userId: data.user_id,
    status: data.status as UserPresence['status'],
    statusMessage: data.status_message,
    lastSeen: data.last_seen,
    metadata: data.metadata,
  };
}

function transformAgent(data: ApiAgent): ConversationAgent {
  return {
    configId: data.config_id,
    name: data.name,
    userId: data.user_id,
    enabled: data.enabled,
  };
}

// ============================================================================
// Conversations Resource
// ============================================================================

export class ConversationsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List all conversations for the current user
   */
  async list(): Promise<PaginatedResponse<Conversation>> {
    const response = await this.http.get<{
      conversations: ApiConversation[];
      total: number;
    }>('/v1/chat/conversations');

    return {
      data: response.conversations.map(transformConversation),
      total: response.total,
      hasMore: false,
    };
  }

  /**
   * Get a conversation by ID
   */
  async get(conversationId: string): Promise<Conversation> {
    const response = await this.http.get<{ conversation: ApiConversation }>(
      `/v1/chat/conversations/${conversationId}`
    );
    return transformConversation(response.conversation);
  }

  /**
   * Create a new conversation
   */
  async create(params: CreateConversationParams): Promise<Conversation> {
    const response = await this.http.post<{ conversation: ApiConversation }>(
      '/v1/chat/conversations',
      {
        type: params.type || 'direct',
        name: params.name,
        participant_ids: params.participantIds,
        agent_config_id: params.agentConfigId,
        metadata: params.metadata,
      }
    );
    return transformConversation(response.conversation);
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(
    conversationId: string,
    params?: ListMessagesParams
  ): Promise<MessagesResponse> {
    const query: Record<string, string | number> = {};
    if (params?.limit) query.limit = params.limit;
    if (params?.offset) query.offset = params.offset;
    if (params?.before) {
      query.before =
        params.before instanceof Date
          ? params.before.toISOString()
          : params.before;
    }

    const response = await this.http.get<{
      messages: ApiMessage[];
      total: number;
      has_more: boolean;
    }>(`/v1/chat/conversations/${conversationId}/messages`, query);

    return {
      messages: response.messages.map(transformMessage),
      total: response.total,
      hasMore: response.has_more,
    };
  }

  /**
   * Send a message to a conversation
   */
  async sendMessage(
    conversationId: string,
    params: SendChatMessageParams
  ): Promise<ChatMessage> {
    const response = await this.http.post<{ message: ApiMessage }>(
      `/v1/chat/conversations/${conversationId}/messages`,
      {
        content: params.content,
        message_type: params.messageType || 'text',
        metadata: params.metadata,
      }
    );
    return transformMessage(response.message);
  }

  /**
   * Mark conversation as read
   */
  async markRead(conversationId: string): Promise<void> {
    await this.http.post(`/v1/chat/conversations/${conversationId}/read`);
  }

  /**
   * Add participants to a conversation
   */
  async addParticipants(
    conversationId: string,
    userIds: string[]
  ): Promise<ConversationParticipant[]> {
    const response = await this.http.post<{
      participants: ApiParticipant[];
    }>(`/v1/chat/conversations/${conversationId}/participants`, {
      user_ids: userIds,
    });
    return response.participants.map(transformParticipant);
  }

  /**
   * Leave a conversation
   */
  async leave(conversationId: string): Promise<void> {
    await this.http.delete(
      `/v1/chat/conversations/${conversationId}/participants/me`
    );
  }

  /**
   * Add an agent to a conversation
   */
  async addAgent(
    conversationId: string,
    params: AddAgentParams
  ): Promise<ConversationAgent | null> {
    const response = await this.http.post<{ agent: ApiAgent | null }>(
      `/v1/chat/conversations/${conversationId}/agent`,
      {
        agent_config_id: params.agentConfigId,
        add_as_participant: params.addAsParticipant ?? true,
      }
    );
    return response.agent ? transformAgent(response.agent) : null;
  }

  /**
   * Remove agent from a conversation
   */
  async removeAgent(conversationId: string): Promise<void> {
    await this.http.delete(`/v1/chat/conversations/${conversationId}/agent`);
  }

  /**
   * Toggle agent enabled/disabled
   */
  async setAgentEnabled(
    conversationId: string,
    enabled: boolean
  ): Promise<void> {
    await this.http.patch(`/v1/chat/conversations/${conversationId}/agent`, {
      enabled,
    });
  }
}

// ============================================================================
// Chat Users Resource
// ============================================================================

export class ChatUsersResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List all users in the tenant
   */
  async list(params?: ListUsersParams): Promise<PaginatedResponse<ChatUserWithPresence>> {
    const query: Record<string, string | number | boolean> = {};
    if (params?.limit) query.limit = params.limit;
    if (params?.offset) query.offset = params.offset;
    if (params?.includeVirtual !== undefined) {
      query.include_virtual = params.includeVirtual;
    }

    const response = await this.http.get<{
      users: ApiChatUserWithPresence[];
      total: number;
    }>('/v1/chat/users', query);

    return {
      data: response.users.map(transformUserWithPresence),
      total: response.total,
      hasMore: false,
    };
  }

  /**
   * Get online users
   */
  async online(): Promise<ChatUserWithPresence[]> {
    const response = await this.http.get<{
      users: ApiChatUserWithPresence[];
    }>('/v1/chat/users/online');

    return response.users.map(transformUserWithPresence);
  }

  /**
   * Get current user profile and presence
   */
  async me(): Promise<ChatUserWithPresence> {
    const response = await this.http.get<{ user: ApiChatUserWithPresence }>(
      '/v1/chat/users/me'
    );
    return transformUserWithPresence(response.user);
  }

  /**
   * Update current user's presence status
   */
  async updateStatus(params: UpdatePresenceParams): Promise<void> {
    await this.http.put('/v1/chat/users/me/status', {
      status: params.status,
      status_message: params.statusMessage,
      metadata: params.metadata,
    });
  }

  /**
   * Get a user by ID
   */
  async get(userId: string): Promise<ChatUserWithPresence> {
    const response = await this.http.get<{ user: ApiChatUserWithPresence }>(
      `/v1/chat/users/${userId}`
    );
    return transformUserWithPresence(response.user);
  }

  /**
   * Get presence for a specific user
   */
  async getPresence(userId: string): Promise<UserPresence> {
    const response = await this.http.get<{ presence: ApiPresence }>(
      `/v1/chat/users/${userId}/presence`
    );
    return transformPresence(response.presence);
  }
}

// ============================================================================
// Chat Resource (combines Conversations and Users)
// ============================================================================

export class ChatResource {
  /** Conversation management */
  readonly conversations: ConversationsResource;

  /** User listing and presence */
  readonly users: ChatUsersResource;

  constructor(http: HttpClient) {
    this.conversations = new ConversationsResource(http);
    this.users = new ChatUsersResource(http);
  }
}
