/**
 * Tests for FederationResource
 *
 * Uses vitest + injected fake fetch. No real network calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  FederationResource,
  FederationConfigError,
  FederationApiError,
} from './federation';
import type {
  FederationConfig,
  FederationKeyRecord,
  MintResult,
  RevokeSessionResult,
  RevokeUserResult,
} from './federation';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const AUTH_URL = 'https://auth.example.com';
const ADMIN_TOKEN = 'tok_admin_abc';
const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const CLIENT_ID = 'client_abc';
const CLIENT_SECRET = 'secret_xyz';
const MINTED_TOKEN_MINT = 'minted_mint_bearer';
const MINTED_TOKEN_REVOKE = 'minted_revoke_bearer';

const SAMPLE_KEY_WIRE = {
  id: 'key-uuid-1',
  tenant_id: TENANT_ID,
  kid: 'k1',
  alg: 'ES256',
  source: 'static' as const,
  created_at: '2026-01-01T00:00:00Z',
};

const SAMPLE_KEY: FederationKeyRecord = {
  id: 'key-uuid-1',
  tenantId: TENANT_ID,
  kid: 'k1',
  alg: 'ES256',
  source: 'static',
  createdAt: '2026-01-01T00:00:00Z',
};

const SAMPLE_MINT_WIRE = {
  access_token: 'eu_tok_abc',
  token_type: 'Bearer' as const,
  session_id: 'sess-uuid-1',
  sub: `tenant:${TENANT_ID}:user:user-123`,
  expires_at: '2026-01-01T01:00:00Z',
  scope: ['chat'],
  audience: ['msgsrv', 'agentsrv', 'voicesrv'],
};

const SAMPLE_MINT: MintResult = {
  accessToken: 'eu_tok_abc',
  tokenType: 'Bearer',
  sessionId: 'sess-uuid-1',
  subject: `tenant:${TENANT_ID}:user:user-123`,
  expiresAt: '2026-01-01T01:00:00Z',
  scope: ['chat'],
  audience: ['msgsrv', 'agentsrv', 'voicesrv'],
};

/** Fake token grant response for client_credentials. */
function makeTokenGrant(token: string, expiresIn = 3600): object {
  return { access_token: token, expires_in: expiresIn, token_type: 'Bearer' };
}

/** Build a Response with a JSON body. */
function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Build a 204 No Content Response. */
function emptyResp(status = 204): Response {
  return new Response(null, { status });
}

/** Build an error Response in authsrv envelope format. */
function errResp(status: number, code: string, message: string): Response {
  return jsonResp({ error: { code, message } }, status);
}

// ---------------------------------------------------------------------------
// Helpers for building a resource with injected fake fetch
// ---------------------------------------------------------------------------

type FakeFetch = ReturnType<typeof vi.fn>;

function makeFed(
  fetchFn: FakeFetch,
  extra?: Partial<FederationConfig>,
): FederationResource {
  return new FederationResource({
    authsrvUrl: AUTH_URL,
    adminToken: ADMIN_TOKEN,
    oauthClient: { id: CLIENT_ID, secret: CLIENT_SECRET },
    fetch: fetchFn as typeof fetch,
    ...extra,
  });
}

/**
 * Build a fake fetch that:
 *  1. Returns the client_credentials grant on requests to /oauth2/token.
 *  2. Delegates any other URL to `handler`.
 */
function withTokenGrant(
  token: string,
  handler: (url: string, init: RequestInit) => Response,
  expiresIn = 3600,
): FakeFetch {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if ((url as string).includes('/oauth2/token')) {
      return jsonResp(makeTokenGrant(token, expiresIn));
    }
    return handler(url as string, init ?? {});
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FederationResource', () => {
  describe('registerKey', () => {
    it('1. happy path — POSTs to correct URL with admin bearer + body', async () => {
      const fakeFetch = vi.fn(async () => jsonResp(SAMPLE_KEY_WIRE, 201));
      const fed = makeFed(fakeFetch);

      const result = await fed.registerKey({
        tenantId: TENANT_ID,
        kid: 'k1',
        alg: 'ES256',
        publicKey: '-----BEGIN PUBLIC KEY-----\nABC\n-----END PUBLIC KEY-----',
      });

      expect(result).toEqual(SAMPLE_KEY);
      expect(fakeFetch).toHaveBeenCalledOnce();

      const [url, init] = fakeFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${AUTH_URL}/v1/tenants/${TENANT_ID}/federation/keys`);
      expect((init.headers as Record<string, string>)['Authorization']).toBe(
        `Bearer ${ADMIN_TOKEN}`,
      );
      const sentBody = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(sentBody).toMatchObject({
        kid: 'k1',
        alg: 'ES256',
        public_key: expect.any(String),
      });
    });

    it('2. throws FederationConfigError when adminToken is absent', async () => {
      const fed = new FederationResource({
        authsrvUrl: AUTH_URL,
        fetch: vi.fn() as typeof fetch,
        // no adminToken
      });
      await expect(
        fed.registerKey({ tenantId: TENANT_ID, kid: 'k1', alg: 'ES256', publicKey: 'pem' }),
      ).rejects.toBeInstanceOf(FederationConfigError);
    });
  });

  describe('registerJwks', () => {
    it('3. happy path — POSTs to /jwks with jwks_uri body field', async () => {
      const wireResp = {
        ...SAMPLE_KEY_WIRE,
        source: 'jwks' as const,
        jwks_uri: 'https://customer.example/.well-known/jwks.json',
        cache_ttl_s: 7200,
      };
      const fakeFetch = vi.fn(async () => jsonResp(wireResp, 201));
      const fed = makeFed(fakeFetch);

      const result = await fed.registerJwks({
        tenantId: TENANT_ID,
        kid: 'k1',
        alg: 'ES256',
        jwksUri: 'https://customer.example/.well-known/jwks.json',
        cacheTtlS: 7200,
      });

      expect(result.source).toBe('jwks');
      expect(result.jwksUri).toBe('https://customer.example/.well-known/jwks.json');
      expect(result.cacheTtlS).toBe(7200);

      const [url, init] = fakeFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${AUTH_URL}/v1/tenants/${TENANT_ID}/federation/jwks`);
      const sentBody = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(sentBody).toMatchObject({
        kid: 'k1',
        alg: 'ES256',
        jwks_uri: 'https://customer.example/.well-known/jwks.json',
        cache_ttl_s: 7200,
      });
    });
  });

  describe('listKeys', () => {
    it('4. happy path — returns { keys: [...] }', async () => {
      const fakeFetch = vi.fn(async () => jsonResp({ keys: [SAMPLE_KEY_WIRE] }));
      const fed = makeFed(fakeFetch);

      const result = await fed.listKeys({ tenantId: TENANT_ID });

      expect(result.keys).toHaveLength(1);
      expect(result.keys[0]).toEqual(SAMPLE_KEY);

      const [url] = fakeFetch.mock.calls[0] as [string];
      expect(url).toBe(`${AUTH_URL}/v1/tenants/${TENANT_ID}/federation/keys`);
    });

    it('includes ?include_revoked=true when requested', async () => {
      const fakeFetch = vi.fn(async () => jsonResp({ keys: [] }));
      const fed = makeFed(fakeFetch);

      await fed.listKeys({ tenantId: TENANT_ID, includeRevoked: true });

      const [url] = fakeFetch.mock.calls[0] as [string];
      expect(url).toContain('include_revoked=true');
    });
  });

  describe('revokeKey', () => {
    it('5. happy path — DELETEs and returns void on 204', async () => {
      const fakeFetch = vi.fn(async () => emptyResp(204));
      const fed = makeFed(fakeFetch);

      const result = await fed.revokeKey({ tenantId: TENANT_ID, kid: 'k1' });

      expect(result).toBeUndefined();
      const [url, init] = fakeFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${AUTH_URL}/v1/tenants/${TENANT_ID}/federation/keys/k1`);
      expect(init.method).toBe('DELETE');
    });
  });

  describe('endUserToken (Mode B)', () => {
    it('6. happy path — mints M2M token then POSTs end-user-token', async () => {
      const fakeFetch = withTokenGrant(MINTED_TOKEN_MINT, (_url, _init) =>
        jsonResp(SAMPLE_MINT_WIRE),
      );
      const fed = makeFed(fakeFetch);

      const result = await fed.endUserToken({
        externalId: 'user-123',
        scope: ['chat'],
      });

      expect(result).toEqual(SAMPLE_MINT);

      // First call: token grant
      const [url1, init1] = fakeFetch.mock.calls[0] as [string, RequestInit];
      expect(url1).toContain('/oauth2/token');
      const grantBody = new URLSearchParams(init1.body as string);
      expect(grantBody.get('grant_type')).toBe('client_credentials');
      expect(grantBody.get('scope')).toBe('federation:mint');
      expect((init1.headers as Record<string, string>)['Authorization']).toMatch(
        /^Basic /,
      );

      // Second call: end-user-token
      const [url2, init2] = fakeFetch.mock.calls[1] as [string, RequestInit];
      expect(url2).toBe(`${AUTH_URL}/v1/auth/end-user-token`);
      expect((init2.headers as Record<string, string>)['Authorization']).toBe(
        `Bearer ${MINTED_TOKEN_MINT}`,
      );
      const sentBody = JSON.parse(init2.body as string) as Record<string, unknown>;
      expect(sentBody).toMatchObject({
        external_id: 'user-123',
        scope: ['chat'],
      });
    });

    it('7. token caching — second call within TTL does NOT re-mint', async () => {
      const fakeFetch = withTokenGrant(MINTED_TOKEN_MINT, (_url, _init) =>
        jsonResp(SAMPLE_MINT_WIRE),
      );
      const fed = makeFed(fakeFetch);

      await fed.endUserToken({ externalId: 'user-123', scope: ['chat'] });
      await fed.endUserToken({ externalId: 'user-456', scope: ['chat'] });

      // One grant + two end-user-token posts
      expect(fakeFetch.mock.calls).toHaveLength(3);
      const tokenGrantCalls = (fakeFetch.mock.calls as [string][]).filter(([url]) =>
        url.includes('/oauth2/token'),
      );
      expect(tokenGrantCalls).toHaveLength(1);
    });

    it('8. token refresh — re-mints after expiry window (now >= expiresAt - 60s)', async () => {
      let fakeNow = 1_000_000_000_000; // ms
      const fakeFetch = withTokenGrant(
        MINTED_TOKEN_MINT,
        (_url, _init) => jsonResp(SAMPLE_MINT_WIRE),
        3600, // expires_in = 3600s
      );
      const fed = makeFed(fakeFetch, { now: () => fakeNow });

      await fed.endUserToken({ externalId: 'user-a', scope: ['chat'] });

      // Advance time past expiry threshold (expires_in - 60s = 3540s)
      fakeNow += 3541 * 1000;

      await fed.endUserToken({ externalId: 'user-b', scope: ['chat'] });

      const tokenGrantCalls = (fakeFetch.mock.calls as [string][]).filter(([url]) =>
        url.includes('/oauth2/token'),
      );
      expect(tokenGrantCalls).toHaveLength(2);
    });

    it('9. inflight dedup — two concurrent calls share ONE token grant', async () => {
      const fakeFetch = withTokenGrant(MINTED_TOKEN_MINT, (_url, _init) =>
        jsonResp(SAMPLE_MINT_WIRE),
      );
      const fed = makeFed(fakeFetch);

      // Fire two concurrent calls before either resolves.
      const [r1, r2] = await Promise.all([
        fed.endUserToken({ externalId: 'user-a', scope: ['chat'] }),
        fed.endUserToken({ externalId: 'user-b', scope: ['chat'] }),
      ]);

      expect(r1).toEqual(SAMPLE_MINT);
      expect(r2).toEqual(SAMPLE_MINT);

      const tokenGrantCalls = (fakeFetch.mock.calls as [string][]).filter(([url]) =>
        url.includes('/oauth2/token'),
      );
      expect(tokenGrantCalls).toHaveLength(1);
    });

    it('16. throws FederationConfigError when oauthClient is absent', async () => {
      const fed = new FederationResource({
        authsrvUrl: AUTH_URL,
        adminToken: ADMIN_TOKEN,
        fetch: vi.fn() as typeof fetch,
        // no oauthClient
      });
      await expect(
        fed.endUserToken({ externalId: 'user-123', scope: ['chat'] }),
      ).rejects.toBeInstanceOf(FederationConfigError);
    });
  });

  describe('federate (Mode A)', () => {
    it('10. happy path — POSTs to /v1/auth/federate with assertion', async () => {
      const fakeFetch = withTokenGrant(MINTED_TOKEN_MINT, (_url, _init) =>
        jsonResp(SAMPLE_MINT_WIRE),
      );
      const fed = makeFed(fakeFetch);

      const result = await fed.federate({
        assertion: 'eyJhbGciOiJFUzI1NiJ9.test.sig',
        scope: ['chat'],
      });

      expect(result).toEqual(SAMPLE_MINT);

      const [url, init] = (fakeFetch.mock.calls as [string, RequestInit][]).find(([u]) =>
        u.includes('/v1/auth/federate'),
      )!;
      expect(url).toBe(`${AUTH_URL}/v1/auth/federate`);
      const sentBody = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(sentBody).toMatchObject({
        assertion: 'eyJhbGciOiJFUzI1NiJ9.test.sig',
        scope: ['chat'],
      });
      // externalId / displayName / email MUST NOT be in the body for Mode A
      expect(sentBody).not.toHaveProperty('external_id');
      expect(sentBody).not.toHaveProperty('email');
    });
  });

  describe('mintEndUserToken routing', () => {
    it('11. routes to Mode A when assertion is set', async () => {
      const fakeFetch = withTokenGrant(MINTED_TOKEN_MINT, (_url, _init) =>
        jsonResp(SAMPLE_MINT_WIRE),
      );
      const fed = makeFed(fakeFetch);

      await fed.mintEndUserToken({
        externalId: 'user-123',
        scope: ['chat'],
        assertion: 'ey.token.sig',
      });

      const endpointCalls = (fakeFetch.mock.calls as [string][]).filter(
        ([url]) => !url.includes('/oauth2/token'),
      );
      expect(endpointCalls[0]![0]).toContain('/v1/auth/federate');
    });

    it('12. routes to Mode B when no assertion is set', async () => {
      const fakeFetch = withTokenGrant(MINTED_TOKEN_MINT, (_url, _init) =>
        jsonResp(SAMPLE_MINT_WIRE),
      );
      const fed = makeFed(fakeFetch);

      await fed.mintEndUserToken({
        externalId: 'user-123',
        scope: ['chat'],
        // no assertion
      });

      const endpointCalls = (fakeFetch.mock.calls as [string][]).filter(
        ([url]) => !url.includes('/oauth2/token'),
      );
      expect(endpointCalls[0]![0]).toContain('/v1/auth/end-user-token');
    });
  });

  describe('revokeSession', () => {
    it('13. POSTs to /v1/auth/federation/revoke with revoke-scope token', async () => {
      // Build a fetch that returns different tokens per scope.
      const fakeFetch = vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('/oauth2/token')) {
          const bodyStr = (init?.body as string) ?? '';
          const params = new URLSearchParams(bodyStr);
          const scope = params.get('scope') ?? '';
          const token = scope === 'federation:revoke' ? MINTED_TOKEN_REVOKE : MINTED_TOKEN_MINT;
          return jsonResp(makeTokenGrant(token));
        }
        if (url.includes('/v1/auth/end-user-token')) {
          return jsonResp(SAMPLE_MINT_WIRE);
        }
        if (url.includes('/v1/auth/federation/revoke')) {
          return jsonResp({ session_id: 'sess-uuid-1', revoked: true });
        }
        return jsonResp({});
      });

      const fed = makeFed(fakeFetch as typeof fetch);

      // First, mint an end-user token (uses federation:mint scope).
      await fed.endUserToken({ externalId: 'user-123', scope: ['chat'] });

      // Then revoke a session (uses federation:revoke scope).
      const result: RevokeSessionResult = await fed.revokeSession({
        sessionId: 'sess-uuid-1',
      });

      expect(result.sessionId).toBe('sess-uuid-1');
      expect(result.revoked).toBe(true);

      // Find the revoke call and confirm it used the revoke-scope token.
      const revokeCall = (fakeFetch.mock.calls as [string, RequestInit][]).find(
        ([url]) => url.includes('/v1/auth/federation/revoke') && !url.includes('user'),
      );
      expect(revokeCall).toBeDefined();
      expect(
        (revokeCall![1].headers as Record<string, string>)['Authorization'],
      ).toBe(`Bearer ${MINTED_TOKEN_REVOKE}`);

      // Confirm both scopes triggered their own token grant.
      const grantCalls = (fakeFetch.mock.calls as [string][]).filter(([url]) =>
        url.includes('/oauth2/token'),
      );
      expect(grantCalls).toHaveLength(2);
    });
  });

  describe('revokeAllForUser', () => {
    it('14. POSTs to /v1/auth/federation/revoke-user with revoked_count + ids', async () => {
      const wireResp = {
        external_id: 'user-123',
        revoked_count: 2,
        session_ids: ['sess-1', 'sess-2'],
      };
      const fakeFetch = withTokenGrant(MINTED_TOKEN_REVOKE, (_url, _init) =>
        jsonResp(wireResp),
      );
      const fed = makeFed(fakeFetch);

      const result: RevokeUserResult = await fed.revokeAllForUser({
        externalId: 'user-123',
      });

      expect(result).toEqual({
        externalId: 'user-123',
        revokedCount: 2,
        sessionIds: ['sess-1', 'sess-2'],
      });

      const [url] = (fakeFetch.mock.calls as [string][]).find(([u]) =>
        u.includes('/revoke-user'),
      )!;
      expect(url).toBe(`${AUTH_URL}/v1/auth/federation/revoke-user`);
    });
  });

  describe('API error mapping', () => {
    it('15. throws FederationApiError with .status and .code on non-2xx', async () => {
      const fakeFetch = vi.fn(async () =>
        errResp(401, 'invalid_token', 'Token signature rejected'),
      );
      const fed = makeFed(fakeFetch);

      let caughtError: unknown;
      try {
        await fed.registerKey({
          tenantId: TENANT_ID,
          kid: 'k1',
          alg: 'ES256',
          publicKey: 'pem',
        });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(FederationApiError);
      const apiErr = caughtError as FederationApiError;
      expect(apiErr.status).toBe(401);
      expect(apiErr.code).toBe('invalid_token');
      expect(apiErr.message).toBe('Token signature rejected');
    });

    it('falls back to synthetic code when body is not JSON', async () => {
      const fakeFetch = vi.fn(
        async () =>
          new Response('Not Found', {
            status: 404,
            headers: { 'Content-Type': 'text/plain' },
          }),
      );
      const fed = makeFed(fakeFetch);

      await expect(
        fed.revokeKey({ tenantId: TENANT_ID, kid: 'k1' }),
      ).rejects.toMatchObject({ status: 404, code: 'http_error' });
    });
  });
});
