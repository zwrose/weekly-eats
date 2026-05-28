// test/manual/__tests__/manifest-io.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadManifest, saveManifest, manifestPath, validateManifest } from '../manifest-io.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'mt-manifest-'));
  mkdirSync(join(tmpDir, 'manifests'), { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('manifestPath', () => {
  it('builds path with sanitized branch + default slot omits suffix', () => {
    expect(manifestPath(tmpDir, 'feat/x', 'default')).toBe(
      join(tmpDir, 'manifests', 'feat%2Fx.json')
    );
  });

  it('includes slot suffix for non-default slot', () => {
    expect(manifestPath(tmpDir, 'feat/x', 'admin')).toBe(
      join(tmpDir, 'manifests', 'feat%2Fx.admin.json')
    );
  });

  it('special-cases bare manifest names with no branch sanitization', () => {
    expect(manifestPath(tmpDir, 'demo', 'default')).toBe(join(tmpDir, 'manifests', 'demo.json'));
  });
});

describe('validateManifest', () => {
  const validManifest = {
    schemaVersion: 1,
    branch: 'feat/x',
    slot: 'default',
    createdAt: '2026-05-26T00:00:00.000Z',
    updatedAt: '2026-05-26T00:00:00.000Z',
    scenarios: [
      { id: 'u', block: 'user-baseline' },
      { id: 'r', block: 'recipes', config: { count: 1, isGlobal: false }, dependsOn: ['u'] },
    ],
  };

  it('accepts a valid manifest', () => {
    expect(() => validateManifest(validManifest)).not.toThrow();
  });

  it('rejects unknown schemaVersion', () => {
    expect(() => validateManifest({ ...validManifest, schemaVersion: 99 })).toThrow(
      /schemaVersion/
    );
  });

  it('rejects missing scenarios array', () => {
    const bad = { ...validManifest, scenarios: undefined };
    expect(() => validateManifest(bad)).toThrow(/scenarios/);
  });

  it('rejects scenario with duplicate id', () => {
    const dup = {
      ...validManifest,
      scenarios: [
        { id: 'a', block: 'user-baseline' },
        { id: 'a', block: 'food-items' },
      ],
    };
    expect(() => validateManifest(dup)).toThrow(/duplicate.*id.*a/i);
  });

  it('rejects dependsOn pointing at non-existent scenario', () => {
    const broken = {
      ...validManifest,
      scenarios: [{ id: 'r', block: 'recipes', dependsOn: ['nope'] }],
    };
    expect(() => validateManifest(broken)).toThrow(/dependency.*nope/i);
  });

  it('rejects invalid branch (shell metachars)', () => {
    expect(() => validateManifest({ ...validManifest, branch: 'feat;rm' })).toThrow(/branch/);
  });

  it('rejects invalid slot', () => {
    expect(() => validateManifest({ ...validManifest, slot: 'bad/slot' })).toThrow(/slot/);
  });
});

describe('saveManifest + loadManifest round-trip', () => {
  it('writes JSON and reads back equal content', async () => {
    const m = {
      schemaVersion: 1 as const,
      branch: 'feat/x',
      slot: 'default',
      createdAt: '2026-05-26T00:00:00.000Z',
      updatedAt: '2026-05-26T00:00:00.000Z',
      scenarios: [{ id: 'u', block: 'user-baseline' }],
    };
    await saveManifest(tmpDir, m);
    const loaded = await loadManifest(manifestPath(tmpDir, 'feat/x', 'default'));
    expect(loaded).toEqual(m);
  });

  it('errors clearly when branch field mismatches filename', async () => {
    const file = join(tmpDir, 'manifests', 'feat%2Fy.json');
    writeFileSync(
      file,
      JSON.stringify({
        schemaVersion: 1,
        branch: 'feat/x', // mismatch
        slot: 'default',
        createdAt: '2026-05-26T00:00:00.000Z',
        updatedAt: '2026-05-26T00:00:00.000Z',
        scenarios: [],
      })
    );
    await expect(loadManifest(file)).rejects.toThrow(/branch.*filename.*mismatch/i);
  });
});
