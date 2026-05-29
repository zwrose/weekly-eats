// test/manual/engine.ts
import type { Db } from 'mongodb';
import type {
  Block,
  BlockContext,
  CliResult,
  CliScenarioResult,
  Manifest,
  ManifestScenario,
  ManualTestStateDoc,
  StatusAllResult,
} from './types.js';
import { KNOWN_COLLECTIONS } from './types.js';
import { stableHash } from './hash.js';
import { SEED_TITLE_PREFIX } from './seedTag.js';

const STATE_COLLECTION = 'manualTestState';

/** Visible branch stamp for seeded display names. branch.slice(0,8) [+ "·"+slot]. */
export function deriveLabel(branch: string, slot: string): string {
  const base = branch.slice(0, 8);
  return slot && slot !== 'default' ? `${base}·${slot}` : base;
}

export function topoSort(scenarios: ManifestScenario[]): string[] {
  const ids = scenarios.map((s) => s.id).sort();
  const deps = new Map<string, Set<string>>();
  for (const s of scenarios) deps.set(s.id, new Set(s.dependsOn ?? []));

  const result: string[] = [];
  const ready: string[] = ids.filter((id) => deps.get(id)!.size === 0);
  ready.sort();

  while (ready.length > 0) {
    const next = ready.shift()!;
    result.push(next);
    for (const id of ids) {
      const d = deps.get(id)!;
      if (d.delete(next) && d.size === 0 && !result.includes(id) && !ready.includes(id)) {
        ready.push(id);
        ready.sort();
      }
    }
  }

  if (result.length !== ids.length) {
    const remaining = ids.filter((i) => !result.includes(i));
    throw new Error(`cycle detected among scenarios: ${remaining.join(', ')}`);
  }
  return result;
}

export function computeDirty(scenarios: ManifestScenario[], roots: Set<string>): Set<string> {
  const dependents = new Map<string, Set<string>>();
  for (const s of scenarios) dependents.set(s.id, new Set());
  for (const s of scenarios) for (const d of s.dependsOn ?? []) dependents.get(d)?.add(s.id);

  const dirty = new Set<string>(roots);
  const queue = [...roots];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const dep of dependents.get(id) ?? []) {
      if (!dirty.has(dep)) {
        dirty.add(dep);
        queue.push(dep);
      }
    }
  }
  return dirty;
}

export class Engine {
  constructor(
    private db: Db,
    private blocks: Map<string, Block>
  ) {}

  private async ensureStateIndex(): Promise<void> {
    const col = this.db.collection<ManualTestStateDoc>(STATE_COLLECTION);
    await col.createIndex(
      { manifestId: 1, scenarioId: 1 },
      { unique: true, name: 'manualTestState_manifest_scenario' }
    );
  }

  private async readState(
    manifestId: string,
    scenarioId: string
  ): Promise<ManualTestStateDoc | null> {
    return this.db
      .collection<ManualTestStateDoc>(STATE_COLLECTION)
      .findOne({ manifestId, scenarioId });
  }

  private async writeState(doc: ManualTestStateDoc): Promise<void> {
    await this.db
      .collection<ManualTestStateDoc>(STATE_COLLECTION)
      .updateOne(
        { manifestId: doc.manifestId, scenarioId: doc.scenarioId },
        { $set: doc },
        { upsert: true }
      );
  }

  private async deleteState(manifestId: string, scenarioId: string): Promise<void> {
    await this.db
      .collection<ManualTestStateDoc>(STATE_COLLECTION)
      .deleteOne({ manifestId, scenarioId });
  }

  async apply(manifest: Manifest, options: { force?: string[] } = {}): Promise<CliResult> {
    await this.ensureStateIndex();
    const manifestId = `${manifest.branch}::${manifest.slot}`;
    const label = deriveLabel(manifest.branch, manifest.slot);
    const command = 'apply';

    // 1. Resolve order
    let order: string[];
    try {
      order = topoSort(manifest.scenarios);
    } catch (e) {
      return failResult(command, manifestId, 1, (e as Error).message);
    }
    const scenById = new Map(manifest.scenarios.map((s) => [s.id, s]));

    // 2. Compute dirty roots
    const dirtyRoots = new Set<string>(options.force ?? []);
    for (const id of order) {
      const s = scenById.get(id)!;
      const block = this.blocks.get(s.block);
      if (!block) {
        return failResult(command, manifestId, 1, `unknown block: ${s.block} (scenario ${s.id})`);
      }
      const cfg = block.validate(s.config);
      const hash = stableHash(cfg);
      const prior = await this.readState(manifestId, id);
      const docsStatus = await block.status({
        db: this.db,
        manifestId,
        scenarioId: id,
        label,
        resolve: () => {
          throw new Error('resolve unavailable in status');
        },
      });
      const dirty =
        !prior || prior.configHash !== hash || !docsStatus.present || prior.lastApplyError != null;
      if (dirty) dirtyRoots.add(id);
    }

    // 3. Transitive dirty
    const dirty = computeDirty(manifest.scenarios, dirtyRoots);

    // 4. Clean dirty in reverse topo
    const cleanOrder = [...order].reverse().filter((id) => dirty.has(id));
    const scenarios: CliScenarioResult[] = [];
    for (const id of cleanOrder) {
      const s = scenById.get(id)!;
      const block = this.blocks.get(s.block)!;
      try {
        await block.clean({
          db: this.db,
          manifestId,
          scenarioId: id,
          label,
          resolve: () => {
            throw new Error('resolve unavailable in clean');
          },
        });
        await this.deleteState(manifestId, id);
      } catch (e) {
        // partial failure during clean; mark scenario failed, continue
        const msg = (e as Error).message;
        await this.writeState({
          manifestId,
          scenarioId: id,
          blockName: s.block,
          configHash: stableHash(block.validate(s.config)),
          state: null,
          lastAppliedAt: new Date(),
          lastConfigJson: JSON.stringify(s.config ?? null),
          lastApplyError: `clean failed: ${msg}`,
        });
      }
    }

    // 5. Apply in topo order. Track in-memory states for resolve().
    const memState = new Map<string, unknown>();
    let hadFailure = false;
    for (const id of order) {
      const s = scenById.get(id)!;
      const block = this.blocks.get(s.block)!;
      const cfg = block.validate(s.config);
      const hash = stableHash(cfg);
      const start = Date.now();

      if (!dirty.has(id)) {
        const prior = await this.readState(manifestId, id);
        memState.set(id, prior?.state);
        scenarios.push({
          id,
          block: s.block,
          status: 'skipped',
          docCount: 0,
          summary: '',
          configHash: hash,
          durationMs: Date.now() - start,
          error: null,
        });
        continue;
      }

      const declaredDeps = new Set(s.dependsOn ?? []);
      const ctx: BlockContext = {
        db: this.db,
        manifestId,
        scenarioId: id,
        label,
        resolve: <T>(depId: string): T => {
          if (!declaredDeps.has(depId)) {
            throw new Error(
              `scenario "${id}" called resolve("${depId}") but did not declare it in dependsOn`
            );
          }
          if (!memState.has(depId)) {
            throw new Error(
              `scenario "${id}" tried to resolve "${depId}" but it has no state (apply order bug)`
            );
          }
          return memState.get(depId) as T;
        },
      };

      try {
        const result = await block.apply(cfg, ctx);
        memState.set(id, result.state);
        await this.writeState({
          manifestId,
          scenarioId: id,
          blockName: s.block,
          configHash: hash,
          state: result.state,
          lastAppliedAt: new Date(),
          lastConfigJson: JSON.stringify(s.config ?? null),
          lastApplyError: null,
        });
        scenarios.push({
          id,
          block: s.block,
          status: 'applied',
          docCount: result.docCount,
          summary: result.summary,
          configHash: hash,
          durationMs: Date.now() - start,
          error: null,
        });
      } catch (e) {
        hadFailure = true;
        const msg = (e as Error).message;
        await this.writeState({
          manifestId,
          scenarioId: id,
          blockName: s.block,
          configHash: hash,
          state: null,
          lastAppliedAt: new Date(),
          lastConfigJson: JSON.stringify(s.config ?? null),
          lastApplyError: msg,
        });
        scenarios.push({
          id,
          block: s.block,
          status: 'failed',
          docCount: 0,
          summary: '',
          configHash: hash,
          durationMs: Date.now() - start,
          error: msg,
        });
        break; // abort run on first failure
      }
    }

    return {
      schemaVersion: 1,
      ok: !hadFailure,
      command,
      manifestId,
      exitCode: hadFailure ? 2 : 0,
      scenarios,
      lock: null,
      warnings: [],
    };
  }

  async clean(manifest: Manifest): Promise<CliResult> {
    await this.ensureStateIndex();
    const manifestId = `${manifest.branch}::${manifest.slot}`;
    const label = deriveLabel(manifest.branch, manifest.slot);
    let order: string[];
    try {
      order = topoSort(manifest.scenarios);
    } catch (e) {
      return failResult('clean', manifestId, 1, (e as Error).message);
    }

    const scenById = new Map(manifest.scenarios.map((s) => [s.id, s]));
    const cleanOrder = [...order].reverse();
    const scenarios: CliScenarioResult[] = [];
    let hadFailure = false;
    for (const id of cleanOrder) {
      const s = scenById.get(id)!;
      const block = this.blocks.get(s.block);
      if (!block) {
        scenarios.push({
          id,
          block: s.block,
          status: 'failed',
          docCount: 0,
          summary: '',
          configHash: '',
          durationMs: 0,
          error: `unknown block: ${s.block}`,
        });
        hadFailure = true;
        continue;
      }
      const start = Date.now();
      try {
        const r = await block.clean({
          db: this.db,
          manifestId,
          scenarioId: id,
          label,
          resolve: () => {
            throw new Error('resolve unavailable in clean');
          },
        });
        await this.deleteState(manifestId, id);
        scenarios.push({
          id,
          block: s.block,
          status: 'cleaned',
          docCount: r.docCount,
          summary: '',
          configHash: '',
          durationMs: Date.now() - start,
          error: null,
        });
      } catch (e) {
        hadFailure = true;
        scenarios.push({
          id,
          block: s.block,
          status: 'failed',
          docCount: 0,
          summary: '',
          configHash: '',
          durationMs: Date.now() - start,
          error: (e as Error).message,
        });
      }
    }
    const warnings = await this.orphanWarnings();
    return {
      schemaVersion: 1,
      ok: !hadFailure,
      command: 'clean',
      manifestId,
      exitCode: hadFailure ? 2 : 0,
      scenarios,
      lock: null,
      warnings,
    };
  }

  async status(manifest: Manifest): Promise<CliResult> {
    await this.ensureStateIndex();
    const manifestId = `${manifest.branch}::${manifest.slot}`;
    const label = deriveLabel(manifest.branch, manifest.slot);
    const order = topoSort(manifest.scenarios);
    const scenById = new Map(manifest.scenarios.map((s) => [s.id, s]));
    const scenarios: CliScenarioResult[] = [];
    for (const id of order) {
      const s = scenById.get(id)!;
      const block = this.blocks.get(s.block);
      if (!block) {
        scenarios.push({
          id,
          block: s.block,
          status: 'failed',
          docCount: 0,
          summary: `unknown block`,
          configHash: '',
          durationMs: 0,
          error: `unknown block: ${s.block}`,
        });
        continue;
      }
      const cfg = block.validate(s.config);
      const hash = stableHash(cfg);
      const prior = await this.readState(manifestId, id);
      const ds = await block.status({
        db: this.db,
        manifestId,
        scenarioId: id,
        label,
        resolve: () => {
          throw new Error('resolve unavailable in status');
        },
      });
      const status: CliScenarioResult['status'] = prior?.lastApplyError
        ? 'failed'
        : !ds.present
          ? 'pending'
          : prior?.configHash === hash
            ? 'applied'
            : 'pending';
      scenarios.push({
        id,
        block: s.block,
        status,
        docCount: ds.docCount,
        summary: '',
        configHash: hash,
        durationMs: 0,
        error: prior?.lastApplyError ?? null,
      });
    }
    const warnings = await this.orphanWarnings();
    return {
      schemaVersion: 1,
      ok: true,
      command: 'status',
      manifestId,
      exitCode: 0,
      scenarios,
      lock: null,
      warnings,
    };
  }

  /** Cross-manifest landscape of the shared DB: per-collection counts grouped by _seedManifestId. */
  async statusAll(): Promise<StatusAllResult> {
    const byId = new Map<string, Record<string, number>>();
    for (const col of KNOWN_COLLECTIONS) {
      const ids = (await this.db.collection(col).distinct('_seedManifestId')) as string[];
      for (const id of ids) {
        if (!id) continue;
        const count = await this.db.collection(col).countDocuments({ _seedManifestId: id });
        if (count === 0) continue;
        const entry = byId.get(id) ?? {};
        entry[col] = count;
        byId.set(id, entry);
      }
    }
    const tracked = new Set(
      (await this.db.collection(STATE_COLLECTION).distinct('manifestId')) as string[]
    );
    return {
      command: 'status-all',
      manifests: [...byId.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([manifestId, collections]) => ({
          manifestId,
          collections,
          hasOrphans: !tracked.has(manifestId),
        })),
    };
  }

  /** Count untagged seed-shaped docs (SEED_TITLE_PREFIX title/name, no _seedManifestId) per collection. */
  private async legacyOrphanCounts(): Promise<Array<{ collection: string; count: number }>> {
    const results: Array<{ collection: string; count: number }> = [];
    for (const col of KNOWN_COLLECTIONS) {
      const count = await this.db.collection(col).countDocuments({
        _seedManifestId: { $exists: false },
        $or: [
          { title: { $regex: `^${escapeRegExp(SEED_TITLE_PREFIX)}` } },
          { name: { $regex: `^${escapeRegExp(SEED_TITLE_PREFIX)}` } },
        ],
      });
      if (count > 0) results.push({ collection: col, count });
    }
    return results;
  }

  /** Detect orphan/untagged seed-shaped docs for a warning on plain clean/status. */
  private async orphanWarnings(): Promise<string[]> {
    const legacy = await this.legacyOrphanCounts();
    const total = legacy.reduce((n, l) => n + l.count, 0);
    return total > 0
      ? [`${total} untagged seed-shaped doc(s) detected — run \`clean --orphans\` to review`]
      : [];
  }

  /**
   * Sweep orphaned seed data on the shared DB. Cross-branch-safe: keys off the
   * shared manualTestState collection + injected branchExists, never on-disk manifests.
   * Targets: (1) untracked = tagged but no state row; (2) stale-branch = branch gone
   * from git (deletes docs + state rows); (3) legacy-untagged = SEED_TITLE_PREFIX docs
   * with no tag (report only). Throws (aborts) if branchExists throws — never mass-deletes.
   */
  async cleanOrphans(opts: {
    branchExists: (branch: string) => boolean;
    dryRun: boolean;
  }): Promise<{
    untracked: string[];
    staleBranch: string[];
    legacy: Array<{ collection: string; count: number }>;
    deleted: number;
    warnings: string[];
  }> {
    // 1. Distinct manifestIds present on docs + tracked manifestIds from state.
    const docIds = new Set<string>();
    for (const col of KNOWN_COLLECTIONS) {
      for (const id of (await this.db.collection(col).distinct('_seedManifestId')) as string[]) {
        if (id) docIds.add(id);
      }
    }
    const stateRows = await this.db
      .collection<ManualTestStateDoc>(STATE_COLLECTION)
      .find({}, { projection: { manifestId: 1, scenarioId: 1 } })
      .toArray();
    const trackedManifestIds = new Set(stateRows.map((s) => s.manifestId));

    // 2. Classify branches FIRST — a throw here aborts before any delete.
    const branchesOnDocs = new Set([...docIds].map((id) => id.split('::')[0]));
    const goneBranches = new Set<string>();
    for (const branch of branchesOnDocs) {
      if (!opts.branchExists(branch)) goneBranches.add(branch);
    }

    // 3. Partition.
    const untracked: string[] = [];
    const staleBranch: string[] = [];
    for (const id of docIds) {
      const branch = id.split('::')[0];
      if (goneBranches.has(branch)) staleBranch.push(id);
      else if (!trackedManifestIds.has(id)) untracked.push(id);
    }

    // 4. Legacy untagged (report only).
    const legacy = await this.legacyOrphanCounts();

    // 5. Backstop.
    const warnings: string[] = [];
    if (branchesOnDocs.size > 0 && goneBranches.size > branchesOnDocs.size / 2) {
      warnings.push(
        `orphan sweep: ${goneBranches.size}/${branchesOnDocs.size} branches flagged gone — verify this is expected`
      );
    }

    // 6. Delete (unless dry-run).
    let deleted = 0;
    const toDelete = [...untracked, ...staleBranch];
    if (!opts.dryRun && toDelete.length > 0) {
      for (const col of KNOWN_COLLECTIONS) {
        const r = await this.db.collection(col).deleteMany({ _seedManifestId: { $in: toDelete } });
        deleted += r.deletedCount ?? 0;
      }
      await this.db.collection(STATE_COLLECTION).deleteMany({ manifestId: { $in: staleBranch } });
    }

    return { untracked, staleBranch, legacy, deleted, warnings };
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function failResult(
  command: string,
  manifestId: string,
  exitCode: number,
  error: string
): CliResult {
  return {
    schemaVersion: 1,
    ok: false,
    command,
    manifestId,
    exitCode,
    scenarios: [],
    lock: null,
    warnings: [error],
  };
}
