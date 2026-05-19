/**
 * Users Resource
 *
 * Authenticate end-users for your customer-tenant apps.
 *
 * These methods call the worker's `/v1/auth/users/*` endpoints, which are
 * intended for *your* application's end-users — not for managing your
 * VeroAI account or its members (see `accounts` for that).
 *
 * @example
 * ```typescript
 * const result = await veroai.users.authenticate({
 *   email: 'jane@customer.example',
 *   password: 'hunter2',
 * });
 *
 * if (UsersResource.isMfaChallenge(result)) {
 *   const session = await veroai.users.completeMfa({
 *     mfa_token: result.mfa_token,
 *     code: '123456',
 *   });
 * } else {
 *   // result is AuthSuccess — store result.access_token / result.refresh_token
 * }
 * ```
 */

import type { HttpClient } from '../utils/http';

// ── Params ─────────────────────────────────────────────────────────────────

export interface AuthenticateParams {
  /** End-user email address */
  email: string;
  /** End-user password */
  password: string;
}

export interface CompleteMfaParams {
  /** MFA token returned from `authenticate()` when `mfa_required` is true */
  mfa_token: string;
  /** TOTP / one-time code from the user's authenticator */
  code: string;
}

// ── Result shapes ──────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  tenant_id: string;
}

export interface AuthTenant {
  id: string;
  name: string;
}

export interface AuthSuccess {
  user: AuthUser;
  tenant: AuthTenant;
  access_token: string;
  refresh_token: string;
  /** Lifetime of the access token in seconds */
  expires_in: number;
}

export interface MfaChallenge {
  mfa_required: true;
  /** Opaque token to pass back to `completeMfa()` along with the user's code */
  mfa_token: string;
}

export type AuthenticateResult = AuthSuccess | MfaChallenge;

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  /** Lifetime of the access token in seconds */
  expires_in: number;
}

// ── Resource ───────────────────────────────────────────────────────────────

export class UsersResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Authenticate an end-user with email + password.
   *
   * Returns either a fully-issued session (`AuthSuccess`) or an MFA challenge
   * (`MfaChallenge`) when the user has MFA enabled. Use
   * {@link UsersResource.isMfaChallenge} to discriminate.
   */
  async authenticate(params: AuthenticateParams): Promise<AuthenticateResult> {
    return this.http.post<AuthenticateResult>('/v1/auth/users/authenticate', params);
  }

  /**
   * Complete an MFA challenge with the code from the user's authenticator.
   *
   * Pass the `mfa_token` from the `MfaChallenge` returned by `authenticate()`.
   */
  async completeMfa(params: CompleteMfaParams): Promise<AuthSuccess> {
    return this.http.post<AuthSuccess>('/v1/auth/users/mfa/challenge', params);
  }

  /**
   * Exchange a refresh token for a new access/refresh token pair.
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    return this.http.post<TokenPair>('/v1/auth/users/refresh', { refresh_token: refreshToken });
  }

  /**
   * Revoke an access or refresh token. Returns when the worker accepts (204).
   */
  async revoke(token: string): Promise<void> {
    await this.http.post<void>('/v1/auth/users/revoke', { token });
  }

  /**
   * Type guard — narrows an {@link AuthenticateResult} to {@link MfaChallenge}.
   */
  static isMfaChallenge(r: AuthenticateResult): r is MfaChallenge {
    return 'mfa_required' in r && r.mfa_required === true;
  }
}
