/**
 * Tests for the Mode-A federation assertion signer.
 */

import { describe, it, expect } from 'vitest';
import { generateKeyPair, exportPKCS8, jwtVerify } from 'jose';
import { signAssertion, SignAssertionError } from './sign-assertion';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function makeKeyPair() {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const pem = await exportPKCS8(privateKey);
  return { privateKey: pem, publicKey };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('signAssertion', () => {
  it('happy path: full claims round-trip and header shape', async () => {
    const { privateKey, publicKey } = await makeKeyPair();

    const jwt = await signAssertion({
      tenantId: 'tenant-uuid-abc',
      externalId: 'user-456',
      kid: 'key-2026-q1',
      privateKey,
      email: 'user@customer.com',
      displayName: 'Avi Cohen',
      scope: ['chat', 'voice'],
    });

    const { payload, protectedHeader } = await jwtVerify(jwt, publicKey, {
      audience: 'vero-authsrv',
    });

    // Header
    expect(protectedHeader.alg).toBe('ES256');
    expect(protectedHeader.kid).toBe('key-2026-q1');
    expect(protectedHeader.typ).toBe('JWT');

    // Claims
    expect(payload.iss).toBe('tenant:tenant-uuid-abc');
    expect(payload.sub).toBe('user-456');
    expect(payload.aud).toBe('vero-authsrv');
    expect(payload.email).toBe('user@customer.com');
    expect((payload as Record<string, unknown>).name).toBe('Avi Cohen');
    expect((payload as Record<string, unknown>).scope).toEqual(['chat', 'voice']);
  });

  it('minimal: no email/name/scope in output when not provided', async () => {
    const { privateKey, publicKey } = await makeKeyPair();

    const jwt = await signAssertion({
      tenantId: 'tenant-xyz',
      externalId: 'user-123',
      kid: 'k1',
      privateKey,
    });

    const { payload } = await jwtVerify(jwt, publicKey, { audience: 'vero-authsrv' });

    expect(payload).not.toHaveProperty('email');
    expect(payload).not.toHaveProperty('name');
    expect(payload).not.toHaveProperty('scope');
  });

  it('lifetime defaults to 60s when ttlSeconds not provided', async () => {
    const { privateKey, publicKey } = await makeKeyPair();

    const jwt = await signAssertion({
      tenantId: 'tenant-t',
      externalId: 'u1',
      kid: 'k1',
      privateKey,
    });

    const { payload } = await jwtVerify(jwt, publicKey, { audience: 'vero-authsrv' });

    const exp = payload.exp as number;
    const iat = payload.iat as number;
    expect(exp - iat).toBe(60);
  });

  it('respects custom ttlSeconds', async () => {
    const { privateKey, publicKey } = await makeKeyPair();

    const jwt = await signAssertion({
      tenantId: 'tenant-t',
      externalId: 'u1',
      kid: 'k1',
      privateKey,
      ttlSeconds: 120,
    });

    const { payload } = await jwtVerify(jwt, publicKey, { audience: 'vero-authsrv' });
    const exp = payload.exp as number;
    const iat = payload.iat as number;
    expect(exp - iat).toBe(120);
  });

  it('throws on ttlSeconds below minimum (10)', async () => {
    const { privateKey } = await makeKeyPair();

    await expect(
      signAssertion({
        tenantId: 't',
        externalId: 'u',
        kid: 'k',
        privateKey,
        ttlSeconds: 10,
      })
    ).rejects.toBeInstanceOf(SignAssertionError);
  });

  it('throws on ttlSeconds above maximum (600)', async () => {
    const { privateKey } = await makeKeyPair();

    await expect(
      signAssertion({
        tenantId: 't',
        externalId: 'u',
        kid: 'k',
        privateKey,
        ttlSeconds: 600,
      })
    ).rejects.toBeInstanceOf(SignAssertionError);
  });

  it('throws SignAssertionError for a garbage PEM — no key material in message', async () => {
    const garbagePem =
      '-----BEGIN PRIVATE KEY-----\nTOTALLYGARBAGE==\n-----END PRIVATE KEY-----';

    let error: unknown;
    try {
      await signAssertion({
        tenantId: 't',
        externalId: 'u',
        kid: 'k',
        privateKey: garbagePem,
      });
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(SignAssertionError);
    const msg = (error as SignAssertionError).message;
    // Ensure the raw key material does not appear in the error
    expect(msg).not.toContain('TOTALLYGARBAG');
  });

  it('throws SignAssertionError when privateKey is not a PKCS#8 PEM', async () => {
    const notPkcs8 = 'just a random string, no PEM header';

    await expect(
      signAssertion({
        tenantId: 't',
        externalId: 'u',
        kid: 'k',
        privateKey: notPkcs8,
      })
    ).rejects.toBeInstanceOf(SignAssertionError);
  });

  it('iss is exactly "tenant:{tenantId}" (string concat, not URL)', async () => {
    const { privateKey, publicKey } = await makeKeyPair();

    const jwt = await signAssertion({
      tenantId: 'acme-corp-uuid',
      externalId: 'u',
      kid: 'k',
      privateKey,
    });

    const { payload } = await jwtVerify(jwt, publicKey, { audience: 'vero-authsrv' });
    expect(payload.iss).toBe('tenant:acme-corp-uuid');
  });

  it('aud is exactly the single string "vero-authsrv"', async () => {
    const { privateKey, publicKey } = await makeKeyPair();

    const jwt = await signAssertion({
      tenantId: 't',
      externalId: 'u',
      kid: 'k',
      privateKey,
    });

    const { payload } = await jwtVerify(jwt, publicKey, { audience: 'vero-authsrv' });
    // jose normalises single-element aud to a string when it's a string in the JWT
    expect(payload.aud).toBe('vero-authsrv');
  });

  it('scope flows through as an array', async () => {
    const { privateKey, publicKey } = await makeKeyPair();

    const jwt = await signAssertion({
      tenantId: 't',
      externalId: 'u',
      kid: 'k',
      privateKey,
      scope: ['chat', 'voice', 'agent'],
    });

    const { payload } = await jwtVerify(jwt, publicKey, { audience: 'vero-authsrv' });
    expect((payload as Record<string, unknown>).scope).toEqual(['chat', 'voice', 'agent']);
  });

  it('now-override produces deterministic iat/exp', async () => {
    const { privateKey, publicKey } = await makeKeyPair();

    const FIXED_MS = 1_716_300_000_000; // a known epoch ms
    const FIXED_S = Math.floor(FIXED_MS / 1000);

    const jwt = await signAssertion({
      tenantId: 't',
      externalId: 'u',
      kid: 'k',
      privateKey,
      ttlSeconds: 60,
      now: () => new Date(FIXED_MS),
    });

    // jwtVerify with clockTolerance to avoid expiry issues in tests
    const { payload } = await jwtVerify(jwt, publicKey, {
      audience: 'vero-authsrv',
      clockTolerance: 86400 * 365 * 10, // 10 years tolerance for determinism test
    });

    expect(payload.iat).toBe(FIXED_S);
    expect(payload.exp).toBe(FIXED_S + 60);
  });
});
