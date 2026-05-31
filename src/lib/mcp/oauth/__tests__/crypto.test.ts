// src/lib/mcp/oauth/__tests__/crypto.test.ts
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { constantTimeEqual, generateSecret, pkceS256Matches, sha256Hex } from '../crypto';

describe('oauth crypto', () => {
  it('generates a high-entropy, url-safe, unique secret each call (S4)', () => {
    const a = generateSecret();
    const b = generateSecret();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/); // base64url, no padding
    // 32 random bytes → exactly 43 base64url chars (catches an entropy regression)
    expect(a.length).toBe(43);
  });

  it('sha256Hex matches the node reference hash', () => {
    const value = 'hello-token';
    const expected = createHash('sha256').update(value).digest('hex');
    expect(sha256Hex(value)).toBe(expected);
  });

  it('constantTimeEqual is true for equal, false for different or different-length', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });

  it('pkceS256Matches verifies an S256 verifier→challenge pair', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    expect(pkceS256Matches(verifier, challenge)).toBe(true);
    expect(pkceS256Matches('wrong-verifier', challenge)).toBe(false);
  });
});
