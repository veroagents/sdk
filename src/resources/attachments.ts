/**
 * Attachments Resource
 */

import type { HttpClient } from '../utils/http';
import type { Attachment } from '../types';

interface ApiAttachment {
  id: string;
  tenant_id: string;
  channel_id: string;
  event_id: string;
  filename: string | null;
  content_type: string;
  size_bytes: number;
  content_id: string | null;
  created_at: string;
}

interface ListAttachmentsApiResponse {
  attachments: ApiAttachment[];
  total: number;
}

interface CreateDownloadTokenApiResponse {
  token: string;
  url: string;
  expires_in: number;
}

function transformAttachment(data: ApiAttachment): Attachment {
  return {
    id: data.id,
    tenantId: data.tenant_id,
    channelId: data.channel_id,
    eventId: data.event_id,
    filename: data.filename,
    contentType: data.content_type,
    sizeBytes: data.size_bytes,
    contentId: data.content_id,
    createdAt: data.created_at,
  };
}

export class AttachmentsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Get attachment metadata
   */
  async get(attachmentId: string): Promise<Attachment> {
    const response = await this.http.get<ApiAttachment>(`/v1/attachments/${attachmentId}`);
    return transformAttachment(response);
  }

  /**
   * List attachments for an event
   */
  async listByEvent(eventId: string): Promise<{ data: Attachment[]; total: number }> {
    const response = await this.http.get<ListAttachmentsApiResponse>(
      `/v1/events/${eventId}/attachments`,
    );

    return {
      data: response.attachments.map(transformAttachment),
      total: response.total,
    };
  }

  /**
   * Delete an attachment
   */
  async delete(attachmentId: string): Promise<void> {
    await this.http.delete(`/v1/attachments/${attachmentId}`);
  }

  /**
   * Generate a signed download URL/token
   */
  async createDownloadToken(
    attachmentId: string,
    options?: { expiresIn?: number },
  ): Promise<{ token: string; url: string; expiresIn: number }> {
    const body: Record<string, unknown> = {};
    if (options?.expiresIn !== undefined) {
      body.expires_in = options.expiresIn;
    }

    const response = await this.http.post<CreateDownloadTokenApiResponse>(
      `/v1/attachments/${attachmentId}/download-token`,
      body,
    );

    return {
      token: response.token,
      url: response.url,
      expiresIn: response.expires_in,
    };
  }

  /**
   * Get the download URL for an attachment (using token auth)
   */
  getDownloadUrl(attachmentId: string, token: string): string {
    const baseUrl = this.http.getBaseUrl();
    return `${baseUrl}/v1/attachments/${attachmentId}/download?token=${encodeURIComponent(token)}`;
  }
}
