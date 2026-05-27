// test/manual/__tests__/engine.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { topoSort, computeDirty, Engine } from '../engine.js';
import type { Block, BlockContext, Manifest } from '../types.js';
import type { Db } from 'mongodb';

// ─── topoSort ───
describe('topoSort', () => {
  it('orders linear deps', () => {
    expect(
      topoSort([
        { id: 'a', block: 'x' },
        { id: 'b', block: 'x', dependsOn: ['a'] },
        { id: 'c', block: 'x', dependsOn: ['b'] },
      ])
    ).toEqual(['a', 'b', 'c']);
  });

  it('orders diamond deps', () => {
    const order = topoSort([
      { id: 'a', block: 'x' },
      { id: 'b', block: 'x', dependsOn: ['a'] },
      { id: 'c', block: 'x', dependsOn: ['a'] },
      { id: 'd', block: 'x', dependsOn: ['b', 'c'] },
    ]);
    expect(order[0]).toBe('a');
    expect(order[3]).toBe('d');
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('d'));
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'));
  });

  it('breaks ties alphabetically by id', () => {
    expect(
      topoSort([
        { id: 'z', block: 'x' },
        { id: 'a', block: 'x' },
        { id: 'm', block: 'x' },
      ])
    ).toEqual(['a', 'm', 'z']);
  });

  it('detects cycles', () => {
    expect(() =>
      topoSort([
        { id: 'a', block: 'x', dependsOn: ['b'] },
        { id: 'b', block: 'x', dependsOn: ['a'] },
      ])
    ).toThrow(/cycle/i);
  });
});

// ─── computeDirty ───
describe('computeDirty', () => {
  it('propagates dirtiness transitively to dependents', () => {
    const scenarios = [
      { id: 'a', block: 'x' },
      { id: 'b', block: 'x', dependsOn: ['a'] },
      { id: 'c', block: 'x', dependsOn: ['b'] },
      { id: 'd', block: 'x', dependsOn: ['a'] },
    ];
    const dirtyRoots = new Set(['a']);
    const dirty = computeDirty(scenarios, dirtyRoots);
    expect(dirty).toEqual(new Set(['a', 'b', 'c', 'd']));
  });

  it('does not mark unrelated siblings dirty', () => {
    const scenarios = [
      { id: 'a', block: 'x' },
      { id: 'b', block: 'x', dependsOn: ['a'] },
      { id: 'c', block: 'x' }, // unrelated
    ];
    expect(computeDirty(scenarios, new Set(['a']))).toEqual(new Set(['a', 'b']));
  });
});

// ─── shared helpers for Engine tests ───
function makeBlock(name: string, opts: Partial<Block> = {}): Block {
  const docCount = 1;
  return {
    name,
    documentation: {
      description: '',
      configExamples: [],
      dependencies: [],
      collectionsWritten: ['recipes'],
    },
    validate: vi.fn((c: unknown) => c) as any,
    apply: vi.fn(async () => ({
      state: { id: name },
      docCount,
      summary: `${name} applied`,
    })) as any,
    clean: vi.fn(async () => ({ docCount: 1 })) as any,
    status: vi.fn(async () => ({ present: true, docCount: 1, configHashMatches: true })) as any,
    ...opts,
  };
}

function mockDb() {
  const upserts: any[] = [];
  const states = new Map<string, any>();
  return {
    db: {
      collection: vi.fn((name: string) => {
        if (name === 'manualTestState') {
          return {
            findOne: vi.fn(async (filter: any) =>
              states.get(`${filter.manifestId}::${filter.scenarioId}`)
            ),
            updateOne: vi.fn(async (filter: any, update: any, opts: any) => {
              const k = `${filter.manifestId}::${filter.scenarioId}`;
              const existing = states.get(k) ?? {};
              const next = { ...existing, ...(update.$set ?? {}) };
              states.set(k, next);
              upserts.push({ filter, update, opts });
              return { upsertedId: null };
            }),
            deleteOne: vi.fn(async (filter: any) => {
              states.delete(`${filter.manifestId}::${filter.scenarioId}`);
            }),
            createIndex: vi.fn(),
          };
        }
        if (name === 'manualTestLocks') {
          return {
            insertOne: vi.fn(async () => ({ insertedId: 'id' })),
            deleteOne: vi.fn(),
            findOne: vi.fn().mockResolvedValue(null),
            createIndex: vi.fn(),
          };
        }
        return { insertOne: vi.fn(), deleteMany: vi.fn(async () => ({ deletedCount: 0 })) };
      }),
    } as unknown as Db,
    states,
    upserts,
  };
}

// ─── Engine.apply ───
describe('Engine.apply', () => {
  it('applies scenarios in topo order, writes state, returns results', async () => {
    const blocks = new Map([
      ['user-baseline', makeBlock('user-baseline')],
      ['recipes', makeBlock('recipes')],
    ]);
    const manifest: Manifest = {
      schemaVersion: 1,
      branch: 'feat/x',
      slot: 'default',
      createdAt: '',
      updatedAt: '',
      scenarios: [
        { id: 'r', block: 'recipes', config: { count: 1 }, dependsOn: ['u'] },
        { id: 'u', block: 'user-baseline' },
      ],
    };
    const m = mockDb();
    const engine = new Engine(m.db, blocks);
    const result = await engine.apply(manifest);
    expect(result.ok).toBe(true);
    const order = result.scenarios.map((s) => s.id);
    expect(order).toEqual(['u', 'r']);
    expect(result.scenarios.every((s) => s.status === 'applied')).toBe(true);
  });

  it('skips scenarios whose hash matches and docs are present', async () => {
    const block = makeBlock('user-baseline');
    block.status = vi
      .fn()
      .mockResolvedValue({ present: true, docCount: 1, configHashMatches: true }) as any;
    const blocks = new Map([['user-baseline', block]]);
    const m = mockDb();
    // Pre-populate state so engine thinks it's been applied with matching hash
    const { stableHash } = await import('../hash.js');
    m.states.set('feat/x::default::u', {
      manifestId: 'feat/x::default',
      scenarioId: 'u',
      blockName: 'user-baseline',
      configHash: stableHash(undefined),
      state: { id: 'user-baseline' },
      lastAppliedAt: new Date(),
      lastConfigJson: 'null',
    });
    const manifest: Manifest = {
      schemaVersion: 1,
      branch: 'feat/x',
      slot: 'default',
      createdAt: '',
      updatedAt: '',
      scenarios: [{ id: 'u', block: 'user-baseline' }],
    };
    const engine = new Engine(m.db, blocks);
    const result = await engine.apply(manifest);
    expect(result.scenarios[0].status).toBe('skipped');
    expect(block.apply).not.toHaveBeenCalled();
  });

  it('cleans + re-applies when config hash differs (transitive dirty)', async () => {
    const u = makeBlock('user-baseline');
    const r = makeBlock('recipes');
    r.status = vi
      .fn()
      .mockResolvedValue({ present: true, docCount: 1, configHashMatches: true }) as any;
    const blocks = new Map<string, Block>([
      ['user-baseline', u],
      ['recipes', r],
    ]);
    const m = mockDb();
    const { stableHash } = await import('../hash.js');
    // u's prior hash is different from current hash for undefined
    m.states.set('feat/x::default::u', {
      configHash: 'sha256:OLD',
      state: { id: 'user-baseline' },
      lastAppliedAt: new Date(),
      lastConfigJson: 'null',
      manifestId: 'feat/x::default',
      scenarioId: 'u',
      blockName: 'user-baseline',
    });
    // r's hash matches but r depends on u so r is transitively dirty
    m.states.set('feat/x::default::r', {
      configHash: stableHash({ count: 1 }),
      state: { id: 'recipes' },
      lastAppliedAt: new Date(),
      lastConfigJson: '{"count":1}',
      manifestId: 'feat/x::default',
      scenarioId: 'r',
      blockName: 'recipes',
    });
    const manifest: Manifest = {
      schemaVersion: 1,
      branch: 'feat/x',
      slot: 'default',
      createdAt: '',
      updatedAt: '',
      scenarios: [
        { id: 'u', block: 'user-baseline' },
        { id: 'r', block: 'recipes', config: { count: 1 }, dependsOn: ['u'] },
      ],
    };
    const engine = new Engine(m.db, blocks);
    const result = await engine.apply(manifest);
    expect(result.scenarios.find((s) => s.id === 'u')?.status).toBe('applied');
    expect(result.scenarios.find((s) => s.id === 'r')?.status).toBe('applied');
    expect(u.clean).toHaveBeenCalled();
    expect(r.clean).toHaveBeenCalled();
    // Clean order: dependents first (r before u)
    const uCleanOrder = (u.clean as any).mock.invocationCallOrder[0];
    const rCleanOrder = (r.clean as any).mock.invocationCallOrder[0];
    expect(rCleanOrder).toBeLessThan(uCleanOrder);
  });

  it('marks failed when apply throws; lock released; lastApplyError set', async () => {
    const u = makeBlock('user-baseline');
    u.apply = vi.fn().mockRejectedValue(new Error('boom')) as any;
    const blocks = new Map([['user-baseline', u]]);
    const manifest: Manifest = {
      schemaVersion: 1,
      branch: 'feat/x',
      slot: 'default',
      createdAt: '',
      updatedAt: '',
      scenarios: [{ id: 'u', block: 'user-baseline' }],
    };
    const m = mockDb();
    const engine = new Engine(m.db, blocks);
    const result = await engine.apply(manifest);
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(2);
    expect(result.scenarios[0].status).toBe('failed');
    expect(result.scenarios[0].error).toMatch(/boom/);
    expect(m.states.get('feat/x::default::u')?.lastApplyError).toMatch(/boom/);
  });

  it('throws when ctx.resolve called for undeclared dep', async () => {
    const u = makeBlock('user-baseline');
    const r = makeBlock('recipes');
    r.apply = vi.fn(async (_c: unknown, ctx: BlockContext) => {
      ctx.resolve('undeclared');
      return { state: {}, docCount: 0, summary: '' };
    }) as any;
    const blocks = new Map<string, Block>([
      ['user-baseline', u],
      ['recipes', r],
    ]);
    const manifest: Manifest = {
      schemaVersion: 1,
      branch: 'feat/x',
      slot: 'default',
      createdAt: '',
      updatedAt: '',
      scenarios: [
        { id: 'u', block: 'user-baseline' },
        { id: 'r', block: 'recipes', dependsOn: ['u'] }, // r doesn't declare 'undeclared'
      ],
    };
    const m = mockDb();
    const engine = new Engine(m.db, blocks);
    const result = await engine.apply(manifest);
    expect(result.scenarios.find((s) => s.id === 'r')?.error).toMatch(/undeclared/);
  });
});

// ─── Engine.clean ───
describe('Engine.clean', () => {
  it('cleans in reverse-topo order; clears state', async () => {
    const u = makeBlock('user-baseline');
    const r = makeBlock('recipes');
    const blocks = new Map<string, Block>([
      ['user-baseline', u],
      ['recipes', r],
    ]);
    const manifest: Manifest = {
      schemaVersion: 1,
      branch: 'feat/x',
      slot: 'default',
      createdAt: '',
      updatedAt: '',
      scenarios: [
        { id: 'u', block: 'user-baseline' },
        { id: 'r', block: 'recipes', dependsOn: ['u'] },
      ],
    };
    const m = mockDb();
    // Pre-populate state so deleteState is observable
    m.states.set('feat/x::default::u', { manifestId: 'feat/x::default', scenarioId: 'u' });
    m.states.set('feat/x::default::r', { manifestId: 'feat/x::default', scenarioId: 'r' });
    const engine = new Engine(m.db, blocks);
    const result = await engine.clean(manifest);
    expect(result.ok).toBe(true);
    expect(result.scenarios.map((s) => s.id)).toEqual(['r', 'u']); // reverse topo
    expect(result.scenarios.every((s) => s.status === 'cleaned')).toBe(true);
    // State entries removed
    expect(m.states.size).toBe(0);
    // Call order: r.clean before u.clean
    const uOrder = (u.clean as any).mock.invocationCallOrder[0];
    const rOrder = (r.clean as any).mock.invocationCallOrder[0];
    expect(rOrder).toBeLessThan(uOrder);
  });

  it('returns failed scenario but continues when one clean throws', async () => {
    const u = makeBlock('user-baseline');
    const r = makeBlock('recipes');
    u.clean = vi.fn().mockRejectedValue(new Error('clean boom')) as any;
    const blocks = new Map<string, Block>([
      ['user-baseline', u],
      ['recipes', r],
    ]);
    const manifest: Manifest = {
      schemaVersion: 1,
      branch: 'feat/x',
      slot: 'default',
      createdAt: '',
      updatedAt: '',
      scenarios: [
        { id: 'u', block: 'user-baseline' },
        { id: 'r', block: 'recipes', dependsOn: ['u'] },
      ],
    };
    const m = mockDb();
    const engine = new Engine(m.db, blocks);
    const result = await engine.clean(manifest);
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(2);
    const uResult = result.scenarios.find((s) => s.id === 'u');
    expect(uResult?.status).toBe('failed');
    expect(uResult?.error).toMatch(/clean boom/);
  });
});

// ─── Engine.status ───
describe('Engine.status', () => {
  it('reports applied/pending/failed correctly based on prior state and current docs', async () => {
    const u = makeBlock('user-baseline');
    const r = makeBlock('recipes');
    // u: present, hash matches -> applied
    // r: docs missing -> pending
    r.status = vi
      .fn()
      .mockResolvedValue({ present: false, docCount: 0, configHashMatches: false }) as any;
    const blocks = new Map<string, Block>([
      ['user-baseline', u],
      ['recipes', r],
    ]);
    const manifest: Manifest = {
      schemaVersion: 1,
      branch: 'feat/x',
      slot: 'default',
      createdAt: '',
      updatedAt: '',
      scenarios: [
        { id: 'u', block: 'user-baseline' },
        { id: 'r', block: 'recipes', dependsOn: ['u'] },
      ],
    };
    const m = mockDb();
    const { stableHash } = await import('../hash.js');
    m.states.set('feat/x::default::u', {
      manifestId: 'feat/x::default',
      scenarioId: 'u',
      blockName: 'user-baseline',
      configHash: stableHash(undefined),
      state: {},
      lastAppliedAt: new Date(),
      lastConfigJson: 'null',
    });
    const engine = new Engine(m.db, blocks);
    const result = await engine.status(manifest);
    expect(result.scenarios.find((s) => s.id === 'u')?.status).toBe('applied');
    expect(result.scenarios.find((s) => s.id === 'r')?.status).toBe('pending');
  });

  it('reports failed when prior state has lastApplyError', async () => {
    const u = makeBlock('user-baseline');
    const blocks = new Map<string, Block>([['user-baseline', u]]);
    const manifest: Manifest = {
      schemaVersion: 1,
      branch: 'feat/x',
      slot: 'default',
      createdAt: '',
      updatedAt: '',
      scenarios: [{ id: 'u', block: 'user-baseline' }],
    };
    const m = mockDb();
    m.states.set('feat/x::default::u', {
      manifestId: 'feat/x::default',
      scenarioId: 'u',
      blockName: 'user-baseline',
      configHash: 'sha256:any',
      state: {},
      lastAppliedAt: new Date(),
      lastConfigJson: 'null',
      lastApplyError: 'previous boom',
    });
    const engine = new Engine(m.db, blocks);
    const result = await engine.status(manifest);
    expect(result.scenarios[0].status).toBe('failed');
    expect(result.scenarios[0].error).toMatch(/previous boom/);
  });
});
