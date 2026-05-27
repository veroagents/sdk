/**
 * Mode-A federation assertion signer. Produces a short-lived ES256 JWT
 * that authsrv accepts at POST /v1/auth/federate as proof the named
 * end-user authenticated against the customer's identity system.
 *
 * The same key whose public half is registered on the tenant via
 * federation.registerKey must be used here. Lifetime is hard-capped at
 * 5 minutes (authsrv rejects longer; matches the spec's defense window).
 */

import { SignJWT, importPKCS8, type KeyLike, type JWTPayload } from 'jose';

const TTL_MIN_S = 30;
const TTL_MAX_S = 300;
const TTL_DEFAULT_S = 60;

/** Thrown when `privateKey` is malformed or `ttlSeconds` is out of bounds. */
export class SignAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignAssertionError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export interface SignAssertionParams {
  /** Tenant UUID this assertion runs under. Becomes the JWT `iss` as
   *  "tenant:{tenantId}". MUST match the tenant whose key signed it. */
  tenantId: string;
  /** Customer's end-user id — opaque to Vero, preserved on the
   *  resulting Vero end-user JWT as `external_id`. */
  externalId: string;
  /** Registered key id — must match the `kid` row in
   *  federation_keys. Placed in the JWT header. */
  kid: string;
  /** Private key in PEM (`-----BEGIN PRIVATE KEY-----`) OR a JWK
   *  object (`{kty:"EC", crv:"P-256", x, y, d}`). For now we accept
   *  PEM string only; JWK can land later if needed. */
  privateKey: string;
  /** Optional claims forwarded to the minted Vero end-user JWT
   *  unchanged. */
  email?: string;
  displayName?: string;
  /** Optional — scope is forwarded to the minted token unless the
   *  customer's mint call overrides it. Empty / undefined → not set. */
  scope?: string[];
  /** Lifetime in seconds. Default 60. Min 30, max 300 (authsrv caps
   *  assertions at 5 min — we cap here too so misconfig fails locally,
   *  not via a 401 from authsrv).  */
  ttlSeconds?: number;
  /** Override `now()` for testing. */
  now?: () => Date;
}

/**
 * Returns the compact-serialised JWT as a string. Throws if the
 * private key can't be parsed as ES256.
 */
export async function signAssertion(p: SignAssertionParams): Promise<string> {
  const ttl = p.ttlSeconds ?? TTL_DEFAULT_S;
  if (ttl < TTL_MIN_S || ttl > TTL_MAX_S) {
    throw new SignAssertionError(
      `ttlSeconds must be between ${TTL_MIN_S} and ${TTL_MAX_S}, got ${ttl}`
    );
  }

  if (!p.privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    throw new SignAssertionError(
      'privateKey must be a PKCS#8 PEM string starting with "-----BEGIN PRIVATE KEY-----"'
    );
  }

  let privateKey: KeyLike;
  try {
    privateKey = await importPKCS8(p.privateKey, 'ES256');
  } catch {
    throw new SignAssertionError(
      'Failed to parse privateKey as an ES256 PKCS#8 PEM. Ensure the key is a P-256 private key.'
    );
  }

  const nowDate = p.now ? p.now() : new Date();
  const iat = Math.floor(nowDate.getTime() / 1000);
  const exp = iat + ttl;

  const claims: JWTPayload = {
    iss: `tenant:${p.tenantId}`,
    sub: p.externalId,
    aud: 'vero-authsrv',
    iat,
    exp,
  };

  if (p.email !== undefined) {
    claims['email'] = p.email;
  }
  if (p.displayName !== undefined) {
    // JWT field is "name" per spec, even though param is displayName
    claims['name'] = p.displayName;
  }
  if (p.scope !== undefined && p.scope.length > 0) {
    claims['scope'] = p.scope;
  }

  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'ES256', kid: p.kid, typ: 'JWT' })
    .sign(privateKey);
}
