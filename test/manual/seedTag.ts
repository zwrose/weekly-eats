// test/manual/seedTag.ts
import type { BlockContext } from './types.js';

/**
 * Shared recognizable prefix for seeded human-facing names. Owned here so the
 * display-name stamps (blocks) and the legacy-orphan heuristic (cli.ts) agree.
 */
export const SEED_TITLE_PREFIX = 'Manual Test ';

/**
 * Build the canonical seed tag for a doc, asserting both ids are non-empty.
 * Every block insert must spread `...seedTag(ctx)` so cleanup can always find it.
 */
export function seedTag(ctx: Pick<BlockContext, 'manifestId' | 'scenarioId'>): {
  _seedManifestId: string;
  _seedScenarioId: string;
} {
  if (!ctx.manifestId) throw new Error('seedTag: manifestId is empty');
  if (!ctx.scenarioId) throw new Error('seedTag: scenarioId is empty');
  return { _seedManifestId: ctx.manifestId, _seedScenarioId: ctx.scenarioId };
}
