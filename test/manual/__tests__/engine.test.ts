// test/manual/__tests__/engine.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { topoSort, computeDirty, Engine, deriveLabel } from '../engine.js';
import type { Block, BlockContext, Manifest } from '../types.js';
import { KNOWN_COLLECTIONS } from '../types.js';
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
        return {
          insertOne: vi.fn(),
          deleteMany: vi.fn(async () => ({ deletedCount: 0 })),
          countDocuments: vi.fn(async () => 0),
        };
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

// ─── deriveLabel ───
describe('deriveLabel', () => {
  it('is the first 8 chars of the branch when slot is default', () => {
    expect(deriveLabel('fix/93-shared-dev-db', 'default')).toBe('fix/93-s');
  });

  it('appends ·slot when slot is not default', () => {
    expect(deriveLabel('fix/93-shared-dev-db', 'admin')).toBe('fix/93-s·admin');
  });

  it('two branches sharing an 8-char prefix collide (cosmetic, accepted)', () => {
    expect(deriveLabel('feature/foo', 'default')).toBe(deriveLabel('feature/bar', 'default'));
  });
});

// ─── Engine.statusAll ───
describe('Engine.statusAll', () => {
  it('groups doc counts by distinct _seedManifestId across collections', async () => {
    const distinctByCol: Record<string, string[]> = {
      recipes: ['a::default', 'b::default'],
      stores: ['a::default'],
    };
    const countByColAndId: Record<string, number> = {
      'recipes|a::default': 2,
      'recipes|b::default': 1,
      'stores|a::default': 1,
    };
    const db = {
      collection: vi.fn((name: string) => {
        if (name === 'manualTestState') {
          return {
            // a::default is tracked, b::default is not
            distinct: vi.fn(async () => ['a::default']),
          };
        }
        return {
          distinct: vi.fn(async () => distinctByCol[name] ?? []),
          countDocuments: vi.fn(
            async (q: { _seedManifestId: string }) =>
              countByColAndId[`${name}|${q._seedManifestId}`] ?? 0
          ),
        };
      }),
    } as unknown as Db;

    const engine = new Engine(db, new Map());
    const result = await engine.statusAll();

    expect(result.command).toBe('status-all');
    const a = result.manifests.find((m) => m.manifestId === 'a::default');
    const b = result.manifests.find((m) => m.manifestId === 'b::default');
    expect(a?.collections.recipes).toBe(2);
    expect(a?.collections.stores).toBe(1);
    expect(b?.collections.recipes).toBe(1);
    // hasOrphans: a::default is tracked → false; b::default is not tracked → true
    expect(a?.hasOrphans).toBe(false);
    expect(b?.hasOrphans).toBe(true);
  });
});

// ─── Engine.cleanOrphans ───
describe('Engine.cleanOrphans', () => {
  function orphanDb(opts: {
    tagsByCol: Record<string, Array<{ _seedManifestId: string; _seedScenarioId: string }>>;
    stateRows: Array<{ manifestId: string; scenarioId: string }>;
    deletes: Record<string, ReturnType<typeof vi.fn>>;
    /** Optional: make countDocuments return >0 for the legacy filter on specific collections. */
    legacyCounts?: Record<string, number>;
  }) {
    const legacyCounts = opts.legacyCounts ?? {};
    return {
      collection: vi.fn((name: string) => {
        if (name === 'manualTestState') {
          return {
            find: vi.fn(() => ({ toArray: vi.fn(async () => opts.stateRows) })),
            deleteMany: opts.deletes['manualTestState'] ?? vi.fn(async () => ({ deletedCount: 0 })),
          };
        }
        const docs = opts.tagsByCol[name] ?? [];
        return {
          distinct: vi.fn(async () => [...new Set(docs.map((d) => d._seedManifestId))]),
          countDocuments: vi.fn(async (query?: any) => {
            // Return legacy count only when the query is the legacy filter shape
            // (i.e. { _seedManifestId: { $exists: false }, $or: [...] })
            const isLegacyFilter = query?._seedManifestId?.$exists === false;
            return isLegacyFilter ? (legacyCounts[name] ?? 0) : 0;
          }),
          deleteMany: opts.deletes[name] ?? vi.fn(async () => ({ deletedCount: docs.length })),
        };
      }),
    } as unknown as Db;
  }

  it('--yes deletes untracked docs (tagged, no manualTestState row)', async () => {
    const recipesDelete = vi.fn(async () => ({ deletedCount: 1 }));
    const db = orphanDb({
      tagsByCol: { recipes: [{ _seedManifestId: 'a::default', _seedScenarioId: 'r' }] },
      stateRows: [],
      deletes: { recipes: recipesDelete },
    });
    const engine = new Engine(db, new Map());
    await engine.cleanOrphans({ branchExists: () => true, dryRun: false });
    expect(recipesDelete).toHaveBeenCalled();
  });

  it('--yes deletes stale-branch docs AND their manualTestState rows', async () => {
    const recipesDelete = vi.fn(async () => ({ deletedCount: 1 }));
    const stateDelete = vi.fn(async () => ({ deletedCount: 1 }));
    const db = orphanDb({
      tagsByCol: { recipes: [{ _seedManifestId: 'gone::default', _seedScenarioId: 'r' }] },
      stateRows: [{ manifestId: 'gone::default', scenarioId: 'r' }],
      deletes: { recipes: recipesDelete, manualTestState: stateDelete },
    });
    const engine = new Engine(db, new Map());
    await engine.cleanOrphans({ branchExists: () => false, dryRun: false });
    expect(recipesDelete).toHaveBeenCalled();
    expect(stateDelete).toHaveBeenCalled();
  });

  it('--dry-run deletes nothing', async () => {
    const recipesDelete = vi.fn(async () => ({ deletedCount: 0 }));
    const db = orphanDb({
      tagsByCol: { recipes: [{ _seedManifestId: 'a::default', _seedScenarioId: 'r' }] },
      stateRows: [],
      deletes: { recipes: recipesDelete },
    });
    const engine = new Engine(db, new Map());
    const r = await engine.cleanOrphans({ branchExists: () => true, dryRun: true });
    expect(recipesDelete).not.toHaveBeenCalled();
    expect(r.untracked.length).toBeGreaterThan(0);
  });

  it('aborts (throws) when branchExists throws — never deletes', async () => {
    const recipesDelete = vi.fn(async () => ({ deletedCount: 0 }));
    const db = orphanDb({
      tagsByCol: { recipes: [{ _seedManifestId: 'a::default', _seedScenarioId: 'r' }] },
      stateRows: [{ manifestId: 'a::default', scenarioId: 'r' }],
      deletes: { recipes: recipesDelete },
    });
    const engine = new Engine(db, new Map());
    await expect(
      engine.cleanOrphans({
        branchExists: () => {
          throw new Error('git broken');
        },
        dryRun: false,
      })
    ).rejects.toThrow(/git broken/);
    expect(recipesDelete).not.toHaveBeenCalled();
  });

  it('legacy-untagged docs appear in result.legacy but deleteMany is never called (dryRun:false)', async () => {
    // Headline #92 guarantee: legacy presence alone never triggers a delete.
    // No tagged docs → no untracked/staleBranch ids → toDelete is empty.
    // legacyCounts drives countDocuments for the legacy filter on 'recipes'.
    const recipesDelete = vi.fn(async () => ({ deletedCount: 0 }));
    const db = orphanDb({
      tagsByCol: {}, // no tagged docs at all
      stateRows: [],
      deletes: { recipes: recipesDelete },
      legacyCounts: { recipes: 5 }, // 5 untagged seed-shaped docs
    });
    const engine = new Engine(db, new Map());
    const result = await engine.cleanOrphans({ branchExists: () => true, dryRun: false });
    // legacy should be reported
    expect(result.legacy.length).toBeGreaterThan(0);
    const recipesLegacy = result.legacy.find((l) => l.collection === 'recipes');
    expect(recipesLegacy?.count).toBe(5);
    // no tagged docs → nothing deleted
    expect(result.untracked).toHaveLength(0);
    expect(result.staleBranch).toHaveLength(0);
    // deleteMany must NOT have been called (legacy never deletes)
    expect(recipesDelete).not.toHaveBeenCalled();
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

// ─── Engine.previewAll ───
describe('Engine.previewAll', () => {
  it('returns distinct branches and total doc count', async () => {
    const ids = ['a::default', 'a::admin', 'b::default'];
    const db = {
      collection: vi.fn(() => ({
        distinct: vi.fn(async () => ids),
        countDocuments: vi.fn(async () => 4),
      })),
    } as unknown as Db;
    const engine = new Engine(db, new Map());
    const p = await engine.previewAll();
    expect(p.branches.sort()).toEqual(['a', 'b']);
    // mock returns 4 per collection; expected total = 4 * KNOWN_COLLECTIONS.length
    expect(p.total).toBe(4 * KNOWN_COLLECTIONS.length);
  });
});

// ─── Engine.cleanByBranch ───
describe('Engine.cleanByBranch', () => {
  it('deletes docs + state across multiple slots; does NOT over-match a .-adjacent sibling', async () => {
    const present = ['release/1.2::default', 'release/1.2::admin', 'release/1X2::default'];
    const recipesDelete = vi.fn(async () => ({ deletedCount: 2 }));
    const stateDelete = vi.fn(async () => ({ deletedCount: 2 }));
    const db = {
      collection: vi.fn((name: string) => {
        if (name === 'manualTestState') {
          return { distinct: vi.fn(async () => present), deleteMany: stateDelete };
        }
        return { distinct: vi.fn(async () => present), deleteMany: recipesDelete };
      }),
    } as unknown as Db;

    const engine = new Engine(db, new Map());
    const r = await engine.cleanByBranch('release/1.2');

    expect(r.matched.sort()).toEqual(['release/1.2::admin', 'release/1.2::default']);
    expect(stateDelete).toHaveBeenCalled();
    // recipesDelete called with an $in that excludes release/1X2::default:
    const calls = recipesDelete.mock.calls;
    const inArg = calls[0]?.[0]?._seedManifestId?.$in ?? [];
    expect(inArg).not.toContain('release/1X2::default');
    expect(inArg).toContain('release/1.2::default');
    expect(inArg).toContain('release/1.2::admin');
    // deleteMany ran for each KNOWN_COLLECTION (all called with the same $in)
    expect(recipesDelete).toHaveBeenCalledTimes(KNOWN_COLLECTIONS.length);
  });
});

// ─── Orphan warning on plain clean / status ───
describe('Engine orphan warnings on clean and status', () => {
  /** Build a db where countDocuments returns legacyCount for non-state collections. */
  function mockDbWithLegacy(legacyCount: number) {
    const states = new Map<string, any>();
    return {
      collection: vi.fn((name: string) => {
        if (name === 'manualTestState') {
          return {
            findOne: vi.fn(async () => null),
            updateOne: vi.fn(async () => ({ upsertedId: null })),
            deleteOne: vi.fn(async () => {}),
            deleteMany: vi.fn(async () => ({ deletedCount: 0 })),
            createIndex: vi.fn(),
          };
        }
        return {
          insertOne: vi.fn(),
          deleteMany: vi.fn(async () => ({ deletedCount: 0 })),
          countDocuments: vi.fn(async () => legacyCount),
        };
      }),
      _states: states,
    } as unknown as Db;
  }

  it('clean surfaces orphan warning when untagged seed-shaped docs exist', async () => {
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
    const db = mockDbWithLegacy(3);
    const engine = new Engine(db, blocks);
    const result = await engine.clean(manifest);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/untagged seed-shaped doc/);
  });

  it('status surfaces orphan warning when untagged seed-shaped docs exist', async () => {
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
    const db = mockDbWithLegacy(2);
    const engine = new Engine(db, blocks);
    const result = await engine.status(manifest);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/untagged seed-shaped doc/);
  });

  it('clean has empty warnings when no untagged seed-shaped docs exist', async () => {
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
    const engine = new Engine(m.db, blocks);
    const result = await engine.clean(manifest);
    expect(result.warnings).toEqual([]);
  });

  it('status has empty warnings when no untagged seed-shaped docs exist', async () => {
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
    const engine = new Engine(m.db, blocks);
    const result = await engine.status(manifest);
    expect(result.warnings).toEqual([]);
  });
});
