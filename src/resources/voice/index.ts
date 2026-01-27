/**
 * Voice Resource
 *
 * Combines voice numbers, calls, and rooms resources
 */

import type { HttpClient } from '../../utils/http';
import { VoiceNumbersResource } from './numbers';
import { VoiceCallsResource } from './calls';
import { VoiceRoomsResource } from './rooms';

export class VoiceResource {
  /**
   * Phone number management
   */
  readonly numbers: VoiceNumbersResource;

  /**
   * Call management
   */
  readonly calls: VoiceCallsResource;

  /**
   * LiveKit WebRTC room management for browser-based voice/video calls
   */
  readonly rooms: VoiceRoomsResource;

  constructor(http: HttpClient) {
    this.numbers = new VoiceNumbersResource(http);
    this.calls = new VoiceCallsResource(http);
    this.rooms = new VoiceRoomsResource(http);
  }
}

// Re-export sub-resources
export { VoiceNumbersResource } from './numbers';
export { VoiceCallsResource } from './calls';
export { VoiceRoomsResource } from './rooms';
