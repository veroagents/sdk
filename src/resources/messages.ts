/**
 * Messages Resource
 */

import type { HttpClient } from '../utils/http';
import type { SendMessageParams, SendMessageResult } from '../types';

interface SendMessageApiResponse {
  message_id: string;
  event_id: string;
  status: 'queued' | 'sent';
  provider_message_id?: string;
}

export class MessagesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Send a message through a channel
   *
   * @example
   * ```typescript
   * // Send an SMS
   * const result = await veroai.messages.send({
   *   channelId: 'ch_abc123',
   *   to: '+15551234567',
   *   content: { type: 'text', text: 'Hello from VeroAI!' }
   * });
   *
   * // Send an email
   * const result = await veroai.messages.send({
   *   channelId: 'ch_def456',
   *   to: 'user@example.com',
   *   subject: 'Welcome!',
   *   content: {
   *     type: 'html',
   *     html: '<h1>Welcome to our platform</h1>'
   *   }
   * });
   * ```
   */
  async send(params: SendMessageParams): Promise<SendMessageResult> {
    const response = await this.http.post<SendMessageApiResponse>('/v1/messages', {
      channel_id: params.channelId,
      to: params.to,
      subject: params.subject,
      content: params.content,
      metadata: params.metadata,
    });

    return {
      messageId: response.message_id,
      eventId: response.event_id,
      status: response.status,
      providerMessageId: response.provider_message_id,
    };
  }

  /**
   * Send a message to multiple recipients (batch)
   *
   * @example
   * ```typescript
   * const results = await veroai.messages.sendBatch({
   *   channelId: 'ch_abc123',
   *   messages: [
   *     { to: '+15551234567', content: { type: 'text', text: 'Hello!' } },
   *     { to: '+15559876543', content: { type: 'text', text: 'Hi there!' } },
   *   ]
   * });
   * ```
   */
  async sendBatch(params: {
    channelId: string;
    messages: Array<{
      to: string;
      subject?: string;
      content: SendMessageParams['content'];
      metadata?: Record<string, unknown>;
    }>;
  }): Promise<SendMessageResult[]> {
    const results: SendMessageResult[] = [];

    // Process in batches of 100
    const batchSize = 100;
    for (let i = 0; i < params.messages.length; i += batchSize) {
      const batch = params.messages.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(msg =>
          this.send({
            channelId: params.channelId,
            to: msg.to,
            subject: msg.subject,
            content: msg.content,
            metadata: msg.metadata,
          })
        )
      );
      results.push(...batchResults);
    }

    return results;
  }
}
