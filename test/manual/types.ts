// test/manual/types.ts
import type { Db, ObjectId } from 'mongodb';
import { SEEDABLE_COLLECTIONS, type SeedableCollection } from '../../src/lib/database-indexes.js';

// ─── Canonical collection names ─────────────────────────────────────────
// Re-export from src/lib/database-indexes.ts (single source of truth).
// Used by registry tests to validate blocks only write to known collections,
// and by `cli.ts clean --all` to iterate every seedable collection.
export const KNOWN_COLLECTIONS = SEEDABLE_COLLECTIONS;
export type KnownCollection = SeedableCollection;

// ─── Manifest ───────────────────────────────────────────────────────────
export interface ManifestScenario {
  id: string;
  block: string;
  config?: unknown;
  dependsOn?: string[];
}

export interface ManifestStepMapping {
  step: string;
  scenarioIds: string[];
  notes?: string;
}

export interface Manifest {
  schemaVersion: 1;
  branch: string;
  slot: string;
  createdAt: string;
  updatedAt: string;
  scenarios: ManifestScenario[];
  stepMappings?: ManifestStepMapping[];
}

// ─── Block interface ────────────────────────────────────────────────────
export interface BlockContext {
  db: Db;
  manifestId: string;
  scenarioId: string;
  /** Short human stamp for display names: branch.slice(0,8) [+ "·"+slot]. */
  label: string;
  resolve: <T = unknown>(id: string) => T;
}

export interface BlockApplyResult<State = unknown> {
  state: State;
  docCount: number;
  summary: string;
}

export interface BlockDocumentation {
  description: string;
  configExamples: Array<{ label: string; config: unknown }>;
  dependencies: string[];
  collectionsWritten: KnownCollection[];
}

export interface Block<Config = unknown, State = unknown> {
  name: string;
  documentation: BlockDocumentation;
  validate(config: unknown): Config;
  apply(config: Config, ctx: BlockContext): Promise<BlockApplyResult<State>>;
  clean(ctx: BlockContext): Promise<{ docCount: number }>;
  status(ctx: BlockContext): Promise<{
    present: boolean;
    docCount: number;
    configHashMatches: boolean;
  }>;
}

// ─── Engine state ───────────────────────────────────────────────────────
export interface ManualTestStateDoc {
  _id?: ObjectId;
  manifestId: string;
  scenarioId: string;
  blockName: string;
  configHash: string;
  state: unknown;
  lastAppliedAt: Date;
  lastConfigJson: string;
  lastApplyError?: string | null;
}

export interface ManualTestLockDoc {
  _id?: ObjectId;
  manifestId: string;
  acquiredAt: Date;
  expireAt: Date;
  pid: number;
  hostname: string;
  cliInvocation: string;
}

// ─── CLI result ─────────────────────────────────────────────────────────
export type ScenarioStatus = 'applied' | 'skipped' | 'failed' | 'cleaned' | 'pending';

export interface CliScenarioResult {
  id: string;
  block: string;
  status: ScenarioStatus;
  docCount: number;
  summary: string;
  configHash: string;
  durationMs: number;
  error: string | null;
}

export interface CliResult {
  schemaVersion: 1;
  ok: boolean;
  command: string;
  manifestId: string | null;
  exitCode: number;
  scenarios: CliScenarioResult[];
  lock: { acquiredAt: string; releasedAt: string } | null;
  warnings: string[];
}
