// test/manual/hash.ts
import { createHash } from 'node:crypto';

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
  const result: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    result[key] = canonicalize((value as Record<string, unknown>)[key]);
  }
  return result;
}

export function stableHash(value: unknown): string {
  // JSON.stringify(undefined) returns undefined, not a string. Use a sentinel
  // so callers passing config-less scenarios still get a stable hash.
  const canonical = canonicalize(value);
  const json = canonical === undefined ? 'undefined' : JSON.stringify(canonical);
  return `sha256:${createHash('sha256').update(json).digest('hex')}`;
}
