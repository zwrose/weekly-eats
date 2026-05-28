// test/manual/__tests__/registry.test.ts
import { describe, it, expect } from 'vitest';
import { registry } from '../scenarios/registry.js';
import { KNOWN_COLLECTIONS } from '../types.js';

describe('registry', () => {
  it('contains 10 blocks', () => {
    expect(registry.size).toBe(10);
  });

  it('every block has a unique name matching its registry key', () => {
    for (const [key, block] of registry.entries()) {
      expect(block.name).toBe(key);
    }
  });

  it('every block has valid documentation', () => {
    for (const [, b] of registry.entries()) {
      expect(b.documentation.description).toBeTruthy();
      expect(Array.isArray(b.documentation.configExamples)).toBe(true);
      expect(Array.isArray(b.documentation.collectionsWritten)).toBe(true);
    }
  });

  it('every collectionsWritten entry is a known collection', () => {
    for (const [, b] of registry.entries()) {
      for (const c of b.documentation.collectionsWritten) {
        expect(KNOWN_COLLECTIONS).toContain(c);
      }
    }
  });

  it('every block exports apply/clean/status/validate functions', () => {
    for (const [, b] of registry.entries()) {
      expect(typeof b.apply).toBe('function');
      expect(typeof b.clean).toBe('function');
      expect(typeof b.status).toBe('function');
      expect(typeof b.validate).toBe('function');
    }
  });
});
