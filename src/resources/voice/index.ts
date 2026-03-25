/**
 * Voice Resource
 *
 * Combines voice numbers, calls, and rooms resources
 */

import type { HttpClient } from '../../utils/http';
import { VoiceNumbersResource } from './numbers';
import { VoiceCallsResource } from './calls';
import { VoiceRoomsResource } from './rooms';
import { VoiceCarriersResource } from './carriers';
import { VoiceApplicationsResource } from './applications';
import { VoiceAgentsResource } from './agents';
import { VoiceProvisioningResource } from './provisioning';

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

  /**
   * SIP trunk carrier management
   */
  readonly carriers: VoiceCarriersResource;

  /**
   * Jambonz application management (voice routing)
   */
  readonly applications: VoiceApplicationsResource;

  /**
   * Voice agent wiring (connect agents to phone numbers)
   */
  readonly agents: VoiceAgentsResource;

  /**
   * Jambonz account provisioning
   */
  readonly provisioning: VoiceProvisioningResource;

  constructor(http: HttpClient) {
    this.numbers = new VoiceNumbersResource(http);
    this.calls = new VoiceCallsResource(http);
    this.rooms = new VoiceRoomsResource(http);
    this.carriers = new VoiceCarriersResource(http);
    this.applications = new VoiceApplicationsResource(http);
    this.agents = new VoiceAgentsResource(http);
    this.provisioning = new VoiceProvisioningResource(http);
  }
}

// Re-export sub-resources
export { VoiceNumbersResource } from './numbers';
export { VoiceCallsResource } from './calls';
export { VoiceRoomsResource } from './rooms';
export { VoiceCarriersResource } from './carriers';
export { VoiceApplicationsResource } from './applications';
export { VoiceAgentsResource } from './agents';
export { VoiceProvisioningResource } from './provisioning';
