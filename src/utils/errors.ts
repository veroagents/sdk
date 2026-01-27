/**
 * VeroAI SDK Error Classes
 */

import type { VeroAIErrorDetails } from '../types';

/**
 * Base error class for all VeroAI SDK errors
 */
export class VeroAIError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly statusCode?: number;

  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    statusCode?: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'VeroAIError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): VeroAIErrorDetails {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

/**
 * Thrown when the API returns an error response
 */
export class APIError extends VeroAIError {
  readonly response?: Response;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    details?: Record<string, unknown>,
    response?: Response
  ) {
    super(message, code, statusCode, details);
    this.name = 'APIError';
    this.response = response;
  }
}

/**
 * Thrown when authentication fails (401)
 */
export class AuthenticationError extends APIError {
  constructor(message: string = 'Invalid API key or token', details?: Record<string, unknown>) {
    super(message, 'AUTHENTICATION_ERROR', 401, details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Thrown when authorization fails (403)
 */
export class AuthorizationError extends APIError {
  constructor(message: string = 'Insufficient permissions', details?: Record<string, unknown>) {
    super(message, 'AUTHORIZATION_ERROR', 403, details);
    this.name = 'AuthorizationError';
  }
}

/**
 * Thrown when a resource is not found (404)
 */
export class NotFoundError extends APIError {
  constructor(message: string = 'Resource not found', details?: Record<string, unknown>) {
    super(message, 'NOT_FOUND', 404, details);
    this.name = 'NotFoundError';
  }
}

/**
 * Thrown when request validation fails (400)
 */
export class ValidationError extends APIError {
  constructor(message: string = 'Invalid request', details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

/**
 * Thrown when rate limit is exceeded (429)
 */
export class RateLimitError extends APIError {
  readonly retryAfter?: number;

  constructor(
    message: string = 'Rate limit exceeded',
    retryAfter?: number,
    details?: Record<string, unknown>
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, details);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Thrown when the server returns an error (5xx)
 */
export class ServerError extends APIError {
  constructor(
    message: string = 'Internal server error',
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message, 'SERVER_ERROR', statusCode, details);
    this.name = 'ServerError';
  }
}

/**
 * Thrown when a request times out
 */
export class TimeoutError extends VeroAIError {
  constructor(message: string = 'Request timed out') {
    super(message, 'TIMEOUT_ERROR');
    this.name = 'TimeoutError';
  }
}

/**
 * Thrown when there's a network connectivity issue
 */
export class NetworkError extends VeroAIError {
  constructor(message: string = 'Network error', cause?: Error) {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}
