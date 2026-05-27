/**
 * Federation Resource
 *
 * Wraps authsrv's federation surface for issuing scoped end-user JWTs.
 * See ~/projects/authsrv/FEDERATED.md for the full design.
 *
 * Auth model is different from the rest of the SDK:
 *  - Admin-token methods (registerKey, registerJwks, listKeys, revokeKey) use
 *    a static AUTHSRV_API_TOKEN as `Authorization: Bearer`.
 *  - Customer M2M methods (mint/revoke) obtain a short-lived bearer via
 *    OAuth2 client_credentials and cache it keyed on the requested scope.
 *
 * This resource does NOT use the SDK's HttpClient — it speaks directly to
 * authsrv at an independent base URL with its own auth scheme.
 *
 * @example
 * ```typescript
 * const fed = new FederationResource({
 *   authsrvUrl: 'https://auth.veroagents.com',
 *   oauthClient: { id: 'client_abc', secret: 'shhh' },
 *   adminToken: process.env.AUTHSRV_API_TOKEN,
 * });
 *
 * // Ops: register a key for a tenant (admin token)
 * await fed.registerKey({ tenantId: 'tid', kid: 'k1', alg: 'ES256', publicKey: pem });
 *
 * // Customer backend: mint a token for their end-user (M2M)
 * const result = await fed.mintEndUserToken({
 *   externalId: 'user-123',
 *   scope: ['chat'],
 * });
 * ```
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface FederationConfig {
  /** authsrv base URL, e.g. "https://auth.veroagents.com" */
  authsrvUrl: string;
  /**
   * OAuth client credentials for the customer's M2M client. Required
   * for mint/revoke methods. Used to mint+cache a client_credentials
   * bearer at runtime.
   */
  oauthClient?: { id: string; secret: string };
  /**
   * AUTHSRV_API_TOKEN — required for the key-registration methods.
   * Vero ops sets this; customer SDK callers usually do not.
   */
  adminToken?: string;
  /** Optional fetch impl override (tests inject; default to globalThis.fetch). */
  fetch?: typeof fetch;
  /** Injectable clock — tests pass `() => fakeMs`; default is `Date.now`. */
  now?: () => number;
}

// ---------------------------------------------------------------------------
// Typed errors
// ---------------------------------------------------------------------------

export class FederationConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FederationConfigError';
  }
}

export class FederationApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'FederationApiError';
  }
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface RegisterKeyParams {
  tenantId: string;
  kid: string;
  alg: 'ES256' | 'RS256' | 'EdDSA';
  publicKey: string;
}

export interface RegisterJWKSParams {
  tenantId: string;
  kid: string;
  alg: 'ES256' | 'RS256' | 'EdDSA';
  jwksUri: string;
  cacheTtlS?: number;
}

export interface ListKeysParams {
  tenantId: string;
  includeRevoked?: boolean;
}

export interface RevokeKeyParams {
  tenantId: string;
  kid: string;
}

export interface EndUserTokenParams {
  externalId: string;
  email?: string;
  displayName?: string;
  /** Required, non-empty. */
  scope: string[];
  /** Default: ["msgsrv","agentsrv","voicesrv"] */
  audience?: string[];
  /** Default: 3600 */
  ttlSeconds?: number;
}

export interface FederateParams {
  /** Signed JWT produced by the caller (Track B). */
  assertion: string;
  /** Body override; default from assertion claims. */
  scope?: string[];
  audience?: string[];
  ttlSeconds?: number;
}

export interface MintEndUserTokenParams extends EndUserTokenParams {
  /**
   * When set, the SDK calls /v1/auth/federate (Mode A) with this
   * assertion; otherwise /v1/auth/end-user-token (Mode B).
   */
  assertion?: string;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface FederationKeyRecord {
  id: string;
  tenantId: string;
  kid: string;
  alg: string;
  source: 'static' | 'jwks';
  jwksUri?: string;
  cacheTtlS?: number;
  createdAt: string;
  revokedAt?: string;
}

export interface ListKeysResult {
  keys: FederationKeyRecord[];
}

export interface MintResult {
  accessToken: string;
  tokenType: 'Bearer';
  sessionId: string;
  /** "tenant:{tid}:user:{ext_id}" */
  subject: string;
  /** ISO timestamp */
  expiresAt: string;
  scope: string[];
  audience: string[];
}

export interface RevokeSessionResult {
  sessionId: string;
  revoked: boolean;
}

export interface RevokeUserResult {
  externalId: string;
  revokedCount: number;
  sessionIds: string[];
}

// ---------------------------------------------------------------------------
// Wire shapes (snake_case — matches Go JSON tags)
// ---------------------------------------------------------------------------

interface WireKeyRecord {
  id: string;
  tenant_id: string;
  kid: string;
  alg: string;
  source: 'static' | 'jwks';
  jwks_uri?: string;
  cache_ttl_s?: number;
  created_at: string;
  revoked_at?: string;
}

interface WireListKeysResult {
  keys: WireKeyRecord[];
}

interface WireMintResult {
  access_token: string;
  token_type: 'Bearer';
  session_id: string;
  sub: string;
  expires_at: string;
  scope: string[];
  audience: string[];
}

interface WireRevokeSessionResult {
  session_id: string;
  revoked: boolean;
}

interface WireRevokeUserResult {
  external_id: string;
  revoked_count: number;
  session_ids: string[];
}

interface WireErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
  };
}

interface WireTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

// ---------------------------------------------------------------------------
// Mappers (wire → SDK types)
// ---------------------------------------------------------------------------

function keyFromWire(w: WireKeyRecord): FederationKeyRecord {
  const out: FederationKeyRecord = {
    id: w.id,
    tenantId: w.tenant_id,
    kid: w.kid,
    alg: w.alg,
    source: w.source,
    createdAt: w.created_at,
  };
  if (w.jwks_uri !== undefined) out.jwksUri = w.jwks_uri;
  if (w.cache_ttl_s !== undefined) out.cacheTtlS = w.cache_ttl_s;
  if (w.revoked_at !== undefined) out.revokedAt = w.revoked_at;
  return out;
}

function mintFromWire(w: WireMintResult): MintResult {
  return {
    accessToken: w.access_token,
    tokenType: w.token_type,
    sessionId: w.session_id,
    subject: w.sub,
    expiresAt: w.expires_at,
    scope: w.scope,
    audience: w.audience,
  };
}

// ---------------------------------------------------------------------------
// OAuth2 token cache entry
// ---------------------------------------------------------------------------

interface TokenEntry {
  token: string;
  expiresAtMs: number;
}

// ---------------------------------------------------------------------------
// FederationResource
// ---------------------------------------------------------------------------

const SCOPE_MINT = 'federation:mint';
const SCOPE_REVOKE = 'federation:revoke';

export class FederationResource {
  private readonly fetchFn: typeof fetch;
  private readonly now: () => number;
  /** In-flight dedup: scope key → pending Promise<TokenEntry> */
  private readonly inFlight: Map<string, Promise<TokenEntry>> = new Map();
  /** Resolved token cache: scope key → TokenEntry */
  private readonly tokenCache: Map<string, TokenEntry> = new Map();

  constructor(private readonly cfg: FederationConfig) {
    this.fetchFn = cfg.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
    this.now = cfg.now ?? (() => Date.now());
  }

  // --------------------------------------------------------------------------
  // Admin-token methods
  // --------------------------------------------------------------------------

  /**
   * Register a static PEM public key for a tenant.
   * Requires `adminToken` in config.
   */
  async registerKey(params: RegisterKeyParams): Promise<FederationKeyRecord> {
    const token = this.requireAdminToken();
    const url = `${this.base}/v1/tenants/${params.tenantId}/federation/keys`;
    const body = {
      kid: params.kid,
      alg: params.alg,
      public_key: params.publicKey,
    };
    const wire = await this.doRequest<WireKeyRecord>(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return keyFromWire(wire);
  }

  /**
   * Register a JWKS URI for a tenant.
   * Requires `adminToken` in config.
   */
  async registerJwks(params: RegisterJWKSParams): Promise<FederationKeyRecord> {
    const token = this.requireAdminToken();
    const url = `${this.base}/v1/tenants/${params.tenantId}/federation/jwks`;
    const body: Record<string, unknown> = {
      kid: params.kid,
      alg: params.alg,
      jwks_uri: params.jwksUri,
    };
    if (params.cacheTtlS !== undefined) {
      body['cache_ttl_s'] = params.cacheTtlS;
    }
    const wire = await this.doRequest<WireKeyRecord>(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return keyFromWire(wire);
  }

  /**
   * List federation keys for a tenant.
   * Requires `adminToken` in config.
   */
  async listKeys(params: ListKeysParams): Promise<ListKeysResult> {
    const token = this.requireAdminToken();
    const qs = params.includeRevoked ? '?include_revoked=true' : '';
    const url = `${this.base}/v1/tenants/${params.tenantId}/federation/keys${qs}`;
    const wire = await this.doRequest<WireListKeysResult>(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    return { keys: wire.keys.map(keyFromWire) };
  }

  /**
   * Revoke a federation key by kid.
   * Requires `adminToken` in config.
   */
  async revokeKey(params: RevokeKeyParams): Promise<void> {
    const token = this.requireAdminToken();
    const url = `${this.base}/v1/tenants/${params.tenantId}/federation/keys/${params.kid}`;
    await this.doRequest<undefined>(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  // --------------------------------------------------------------------------
  // Customer M2M methods
  // --------------------------------------------------------------------------

  /**
   * Smart entry point — routes to Mode A (`/v1/auth/federate`) when
   * `assertion` is provided, Mode B (`/v1/auth/end-user-token`) otherwise.
   * Requires `oauthClient` in config.
   */
  async mintEndUserToken(params: MintEndUserTokenParams): Promise<MintResult> {
    if (params.assertion) {
      return this.federate({
        assertion: params.assertion,
        scope: params.scope,
        audience: params.audience,
        ttlSeconds: params.ttlSeconds,
      });
    }
    return this.endUserToken(params);
  }

  /**
   * Mode A — exchange a signed assertion JWT for a Vero end-user token.
   * Requires `oauthClient` in config.
   */
  async federate(params: FederateParams): Promise<MintResult> {
    const bearer = await this.getM2MToken(SCOPE_MINT);
    const body: Record<string, unknown> = { assertion: params.assertion };
    if (params.scope !== undefined) body['scope'] = params.scope;
    if (params.audience !== undefined) body['audience'] = params.audience;
    if (params.ttlSeconds !== undefined) body['ttl_s'] = params.ttlSeconds;
    const wire = await this.doRequest<WireMintResult>(
      `${this.base}/v1/auth/federate`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${bearer}` },
        body: JSON.stringify(body),
      },
    );
    return mintFromWire(wire);
  }

  /**
   * Mode B — assert end-user identity directly (backed by M2M token trust).
   * Requires `oauthClient` in config.
   */
  async endUserToken(params: EndUserTokenParams): Promise<MintResult> {
    const bearer = await this.getM2MToken(SCOPE_MINT);
    const body: Record<string, unknown> = {
      external_id: params.externalId,
      scope: params.scope,
    };
    if (params.email !== undefined) body['email'] = params.email;
    if (params.displayName !== undefined) body['display_name'] = params.displayName;
    if (params.audience !== undefined) body['audience'] = params.audience;
    if (params.ttlSeconds !== undefined) body['ttl_s'] = params.ttlSeconds;
    const wire = await this.doRequest<WireMintResult>(
      `${this.base}/v1/auth/end-user-token`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${bearer}` },
        body: JSON.stringify(body),
      },
    );
    return mintFromWire(wire);
  }

  /**
   * Revoke a specific federation session.
   * Requires `oauthClient` in config.
   */
  async revokeSession(params: { sessionId: string }): Promise<RevokeSessionResult> {
    const bearer = await this.getM2MToken(SCOPE_REVOKE);
    const wire = await this.doRequest<WireRevokeSessionResult>(
      `${this.base}/v1/auth/federation/revoke`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${bearer}` },
        body: JSON.stringify({ session_id: params.sessionId }),
      },
    );
    return { sessionId: wire.session_id, revoked: wire.revoked };
  }

  /**
   * Revoke all active sessions for an end-user.
   * Requires `oauthClient` in config.
   */
  async revokeAllForUser(params: { externalId: string }): Promise<RevokeUserResult> {
    const bearer = await this.getM2MToken(SCOPE_REVOKE);
    const wire = await this.doRequest<WireRevokeUserResult>(
      `${this.base}/v1/auth/federation/revoke-user`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${bearer}` },
        body: JSON.stringify({ external_id: params.externalId }),
      },
    );
    return {
      externalId: wire.external_id,
      revokedCount: wire.revoked_count,
      sessionIds: wire.session_ids,
    };
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private get base(): string {
    return this.cfg.authsrvUrl.replace(/\/$/, '');
  }

  private requireAdminToken(): string {
    if (!this.cfg.adminToken) {
      throw new FederationConfigError(
        'adminToken is required for key-registration methods',
      );
    }
    return this.cfg.adminToken;
  }

  private requireOAuthClient(): { id: string; secret: string } {
    if (!this.cfg.oauthClient) {
      throw new FederationConfigError(
        'oauthClient is required for M2M mint/revoke methods',
      );
    }
    return this.cfg.oauthClient;
  }

  /**
   * Returns a cached, valid M2M bearer for the given scope.
   * Concurrent callers hitting a cold/expired cache share a single inflight
   * request (inflight-dedup via stored Promise).
   */
  private getM2MToken(scope: string): Promise<string> {
    const cacheKey = scope.split(' ').sort().join(' ');

    // Serve from cache if still fresh (>= 60s before expiry).
    const cached = this.tokenCache.get(cacheKey);
    if (cached && this.now() < cached.expiresAtMs - 60_000) {
      return Promise.resolve(cached.token);
    }

    // Serve from inflight promise if one is already in progress.
    const existing = this.inFlight.get(cacheKey);
    if (existing) {
      return existing.then(e => e.token);
    }

    // Start a new fetch and store the promise for dedup before awaiting.
    const promise = this.fetchM2MToken(scope, cacheKey);
    this.inFlight.set(cacheKey, promise);
    return promise.then(e => e.token);
  }

  private async fetchM2MToken(scope: string, cacheKey: string): Promise<TokenEntry> {
    const client = this.requireOAuthClient();
    const credentials = btoa(`${client.id}:${client.secret}`);
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      scope,
    });

    let response: Response;
    try {
      response = await this.fetchFn(`${this.base}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${credentials}`,
        },
        body: body.toString(),
      });
    } catch (cause) {
      this.inFlight.delete(cacheKey);
      throw cause;
    }

    if (!response.ok) {
      this.inFlight.delete(cacheKey);
      await this.throwApiError(response);
    }

    const wire = (await response.json()) as WireTokenResponse;
    const entry: TokenEntry = {
      token: wire.access_token,
      expiresAtMs: this.now() + wire.expires_in * 1000,
    };
    this.tokenCache.set(cacheKey, entry);
    this.inFlight.delete(cacheKey);
    return entry;
  }

  /**
   * Low-level fetch wrapper — sets JSON Content-Type, throws FederationApiError
   * on non-2xx. Returns undefined for 204 No Content.
   */
  private async doRequest<T>(
    url: string,
    init: { method: string; headers: Record<string, string>; body?: string },
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...init.headers,
    };
    // GET/DELETE have no body; don't send Content-Type for those.
    if (init.method === 'GET' || init.method === 'DELETE') {
      delete headers['Content-Type'];
    }

    const response = await this.fetchFn(url, {
      method: init.method,
      headers,
      body: init.body,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    if (!response.ok) {
      await this.throwApiError(response);
    }

    return (await response.json()) as T;
  }

  private async throwApiError(response: Response): Promise<never> {
    let code = 'http_error';
    let message = response.statusText || `HTTP ${response.status}`;
    try {
      const envelope = (await response.json()) as WireErrorEnvelope;
      if (envelope?.error?.code) code = envelope.error.code;
      if (envelope?.error?.message) message = envelope.error.message;
    } catch {
      // Non-JSON body — keep defaults.
    }
    throw new FederationApiError(response.status, code, message);
  }
}
