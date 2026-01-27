/**
 * HTTP Client for VeroAI SDK
 */

import type { VeroAIConfig } from '../types';
import {
  APIError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  ServerError,
  TimeoutError,
  NetworkError,
} from './errors';

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  timeout?: number;
}

export class HttpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly fetchFn: typeof fetch;

  constructor(config: VeroAIConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl?.replace(/\/$/, '') || 'https://api.veroai.dev';
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries ?? 3;
    this.fetchFn = config.fetch || globalThis.fetch;

    if (!this.apiKey) {
      throw new Error('API key is required');
    }

    if (!this.fetchFn) {
      throw new Error(
        'fetch is not available. Please provide a fetch implementation or use Node.js >= 18.'
      );
    }
  }

  async request<T>(options: RequestOptions): Promise<T> {
    const url = this.buildUrl(options.path, options.query);
    const headers = this.buildHeaders(options.headers);
    const timeout = options.timeout || this.timeout;

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      try {
        const response = await this.executeRequest(url, {
          method: options.method,
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
          timeout,
        });

        if (!response.ok) {
          const error = await this.handleErrorResponse(response);

          // Only retry on 5xx errors or rate limits with retry-after
          if (response.status >= 500 || response.status === 429) {
            const retryAfter = this.getRetryAfter(response, attempt);
            if (attempt < this.maxRetries && retryAfter > 0) {
              await this.sleep(retryAfter);
              attempt++;
              continue;
            }
          }

          throw error;
        }

        // Handle 204 No Content
        if (response.status === 204) {
          return undefined as T;
        }

        return await response.json() as T;
      } catch (error) {
        if (error instanceof APIError) {
          throw error;
        }

        lastError = error as Error;

        // Retry on network errors
        if (attempt < this.maxRetries) {
          await this.sleep(this.calculateBackoff(attempt));
          attempt++;
          continue;
        }

        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new NetworkError('Failed to connect to API', error);
        }

        throw error;
      }
    }

    throw lastError || new NetworkError('Request failed after retries');
  }

  private async executeRequest(
    url: string,
    options: {
      method: string;
      headers: Headers;
      body?: string;
      timeout: number;
    }
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    try {
      return await this.fetchFn(url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(`Request timed out after ${options.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(path.startsWith('/') ? path : `/${path}`, this.baseUrl);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  }

  private buildHeaders(custom?: Record<string, string>): Headers {
    const headers = new Headers({
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': '@veroai/sdk/0.1.0',
    });

    if (custom) {
      for (const [key, value] of Object.entries(custom)) {
        headers.set(key, value);
      }
    }

    return headers;
  }

  private async handleErrorResponse(response: Response): Promise<APIError> {
    let errorData: { error?: { code?: string; message?: string; details?: Record<string, unknown> } } = {};

    try {
      const json = await response.json();
      if (json && typeof json === 'object') {
        errorData = json as typeof errorData;
      }
    } catch {
      // Response body is not JSON
    }

    const code = errorData.error?.code || 'API_ERROR';
    const message = errorData.error?.message || response.statusText || 'Unknown error';
    const details = errorData.error?.details;

    switch (response.status) {
      case 400:
        return new ValidationError(message, details);
      case 401:
        return new AuthenticationError(message, details);
      case 403:
        return new AuthorizationError(message, details);
      case 404:
        return new NotFoundError(message, details);
      case 429: {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
        return new RateLimitError(message, retryAfter, details);
      }
      default:
        if (response.status >= 500) {
          return new ServerError(message, response.status, details);
        }
        return new APIError(message, code, response.status, details, response);
    }
  }

  private getRetryAfter(response: Response, attempt: number): number {
    const retryAfterHeader = response.headers.get('Retry-After');
    if (retryAfterHeader) {
      const retryAfter = parseInt(retryAfterHeader, 10);
      if (!isNaN(retryAfter)) {
        return retryAfter * 1000; // Convert to ms
      }
    }
    return this.calculateBackoff(attempt);
  }

  private calculateBackoff(attempt: number): number {
    // Exponential backoff with jitter: 1s, 2s, 4s, 8s...
    const baseDelay = Math.min(1000 * Math.pow(2, attempt), 30000);
    const jitter = Math.random() * 1000;
    return baseDelay + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Convenience methods
  async get<T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>({ method: 'GET', path, query });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>({ method: 'POST', path, body });
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>({ method: 'PUT', path, body });
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>({ method: 'PATCH', path, body });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>({ method: 'DELETE', path });
  }
}
