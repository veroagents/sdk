/**
 * Voice Applications Resource
 *
 * Manages Jambonz application CRUD for voice routing
 */

import type { HttpClient } from '../../utils/http';
import type {
  VoiceApplication,
  CreateApplicationParams,
  UpdateApplicationParams,
} from '../../types';

// API response shapes
interface ApiApplication {
  application_sid: string;
  name: string;
  account_sid: string;
  call_hook: { url: string; method: string; webhook_sid?: string } | null;
  call_status_hook: { url: string; method: string; webhook_sid?: string } | null;
  speech_synthesis_vendor: string | null;
  speech_synthesis_voice: string | null;
  speech_recognizer_vendor: string | null;
  speech_recognizer_language: string | null;
}

interface ListApplicationsApiResponse {
  applications: ApiApplication[];
  total: number;
}

interface CreateApplicationApiResponse {
  application: ApiApplication;
  message: string;
}

interface UpdateApplicationApiResponse {
  application: ApiApplication;
}

function transformApplication(data: ApiApplication): VoiceApplication {
  return {
    applicationSid: data.application_sid,
    name: data.name,
    accountSid: data.account_sid,
    callHook: data.call_hook,
    callStatusHook: data.call_status_hook,
    speechSynthesisVendor: data.speech_synthesis_vendor,
    speechSynthesisVoice: data.speech_synthesis_voice,
    speechRecognizerVendor: data.speech_recognizer_vendor,
    speechRecognizerLanguage: data.speech_recognizer_language,
  };
}

export class VoiceApplicationsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List all applications for the tenant's Jambonz account
   */
  async list(): Promise<VoiceApplication[]> {
    const response = await this.http.get<ListApplicationsApiResponse>('/v1/voice/applications');
    return response.applications.map(transformApplication);
  }

  /**
   * Get a specific application by SID
   */
  async get(applicationSid: string): Promise<VoiceApplication> {
    const response = await this.http.get<ApiApplication>(`/v1/voice/applications/${applicationSid}`);
    return transformApplication(response);
  }

  /**
   * Create a new Jambonz application
   */
  async create(params: CreateApplicationParams): Promise<VoiceApplication> {
    const response = await this.http.post<CreateApplicationApiResponse>('/v1/voice/applications', {
      name: params.name,
      call_hook_url: params.callHookUrl,
      call_status_hook_url: params.callStatusHookUrl,
      speech_synthesis_vendor: params.speechSynthesisVendor,
      speech_synthesis_voice: params.speechSynthesisVoice,
      speech_recognizer_vendor: params.speechRecognizerVendor,
      speech_recognizer_language: params.speechRecognizerLanguage,
    });
    return transformApplication(response.application);
  }

  /**
   * Update an existing application
   */
  async update(applicationSid: string, params: UpdateApplicationParams): Promise<VoiceApplication> {
    const response = await this.http.put<UpdateApplicationApiResponse>(
      `/v1/voice/applications/${applicationSid}`,
      {
        name: params.name,
        call_hook_url: params.callHookUrl,
        call_status_hook_url: params.callStatusHookUrl,
        speech_synthesis_vendor: params.speechSynthesisVendor,
        speech_synthesis_voice: params.speechSynthesisVoice,
        speech_recognizer_vendor: params.speechRecognizerVendor,
        speech_recognizer_language: params.speechRecognizerLanguage,
      },
    );
    return transformApplication(response.application);
  }

  /**
   * Delete an application
   */
  async delete(applicationSid: string): Promise<void> {
    await this.http.delete(`/v1/voice/applications/${applicationSid}`);
  }
}
