/**
 * Messaging Resource
 *
 * Get WebSocket tokens for chat messaging via msgsrv
 */

import type { HttpClient } from '../utils/http';
import type { MessagingToken } from '../types';

export class MessagingResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Get a short-lived WebSocket token for chat messaging
   *
   * @example
   * ```typescript
   * const { token, wsUrl, expiresAt } = await veroai.messaging.getToken();
   * // Use token to connect to the messaging WebSocket
   * const ws = new WebSocket(`${wsUrl}?token=${token}`);
   * ```
   */
  async getToken(): Promise<MessagingToken> {
    const response = await this.http.get<{ token: string; ws_url: string; expires_at: string }>('/v1/messaging/token');
    return {
      token: response.token,
      wsUrl: response.ws_url,
      expiresAt: response.expires_at,
    };
  }
}
