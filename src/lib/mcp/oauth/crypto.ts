// src/lib/mcp/oauth/crypto.ts
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** CSPRNG secret, ≥256 bits, url-safe (tokens, codes, state nonces) — S4. */
export function generateSecret(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 hex digest. Secrets are stored hashed at rest (M2/S1). */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Length-checked constant-time string compare. Both sides are encoded as utf8
 * explicitly so the byte-length comparison is well-defined for any caller (the
 * current callers pass ASCII base64url/hex strings).
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** RFC 7636 S256: base64url(SHA-256(verifier)) === challenge (sec-004). */
export function pkceS256Matches(verifier: string, challenge: string): boolean {
  const computed = createHash('sha256').update(verifier).digest('base64url');
  return constantTimeEqual(computed, challenge);
}
