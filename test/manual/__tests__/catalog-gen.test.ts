// test/manual/__tests__/catalog-gen.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateCatalog } from '../catalog-gen.js';
import { registry } from '../scenarios/registry.js';

describe('generateCatalog', () => {
  it('renders deterministic markdown', () => {
    const a = generateCatalog(registry);
    const b = generateCatalog(registry);
    expect(a).toBe(b);
  });

  it('includes every block name', () => {
    const md = generateCatalog(registry);
    for (const name of registry.keys()) expect(md).toContain(`### \`${name}\``);
  });

  it('includes each block description', () => {
    const md = generateCatalog(registry);
    for (const block of registry.values()) expect(md).toContain(block.documentation.description);
  });

  it('includes config examples', () => {
    const md = generateCatalog(registry);
    for (const block of registry.values()) {
      for (const ex of block.documentation.configExamples) {
        expect(md).toContain(ex.label);
      }
    }
  });

  it('includes collectionsWritten', () => {
    const md = generateCatalog(registry);
    for (const block of registry.values()) {
      for (const c of block.documentation.collectionsWritten) {
        expect(md).toContain(c);
      }
    }
  });

  it('matches the committed CATALOG.md (drift detection)', () => {
    const committed = readFileSync(resolve(__dirname, '../scenarios/CATALOG.md'), 'utf8');
    const generated = generateCatalog(registry);
    expect(committed.trim()).toBe(generated.trim());
  });
});
