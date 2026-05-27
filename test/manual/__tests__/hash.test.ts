// test/manual/__tests__/hash.test.ts
import { describe, it, expect } from 'vitest';
import { stableHash } from '../hash.js';

describe('stableHash', () => {
  it('produces a sha256-prefixed string', () => {
    expect(stableHash({ a: 1 })).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('produces identical hashes regardless of key order', () => {
    expect(stableHash({ a: 1, b: 2 })).toBe(stableHash({ b: 2, a: 1 }));
  });

  it('handles nested objects with stable key order', () => {
    expect(stableHash({ a: { b: 1, c: 2 }, d: 3 })).toBe(stableHash({ d: 3, a: { c: 2, b: 1 } }));
  });

  it('preserves array order (arrays are ordered)', () => {
    expect(stableHash([1, 2, 3])).not.toBe(stableHash([3, 2, 1]));
  });

  it('distinguishes string from number', () => {
    expect(stableHash({ a: 1 })).not.toBe(stableHash({ a: '1' }));
  });

  it('handles null, undefined-elided, and empty objects', () => {
    expect(stableHash({ a: null })).not.toBe(stableHash({ a: 0 }));
    expect(stableHash({})).toMatch(/^sha256:/);
  });
});
