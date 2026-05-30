import { describe, it, expect } from 'vitest';
import { seedTag, SEED_TITLE_PREFIX } from '../seedTag.js';

describe('seedTag', () => {
  it('returns the two tag fields from ctx', () => {
    expect(seedTag({ manifestId: 'feat/x::default', scenarioId: 'r' })).toEqual({
      _seedManifestId: 'feat/x::default',
      _seedScenarioId: 'r',
    });
  });

  it('throws when manifestId is empty', () => {
    expect(() => seedTag({ manifestId: '', scenarioId: 'r' })).toThrow(/manifestId/);
  });

  it('throws when scenarioId is empty', () => {
    expect(() => seedTag({ manifestId: 'feat/x::default', scenarioId: '' })).toThrow(/scenarioId/);
  });
});

describe('SEED_TITLE_PREFIX', () => {
  it('is the shared recognizable seed prefix', () => {
    expect(SEED_TITLE_PREFIX).toBe('Manual Test ');
  });
});
