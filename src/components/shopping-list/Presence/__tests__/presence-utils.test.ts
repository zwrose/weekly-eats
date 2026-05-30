import { describe, it, expect } from 'vitest';
import { presenceInitials, presenceColor, PRESENCE_PALETTE } from '../presence-utils';

describe('presenceInitials', () => {
  it('takes the first letter of the first two name words, uppercased', () => {
    expect(presenceInitials('Sara Rose')).toBe('SR');
  });
  it('falls back to one letter for a single-word name', () => {
    expect(presenceInitials('jamie')).toBe('J');
  });
  it('falls back to "?" for an empty name', () => {
    expect(presenceInitials('')).toBe('?');
  });
});

describe('presenceColor', () => {
  it('is deterministic for the same key', () => {
    expect(presenceColor('sara@x.com')).toBe(presenceColor('sara@x.com'));
  });
  it('returns a color from the fixed palette', () => {
    expect(PRESENCE_PALETTE).toContain(presenceColor('sara@x.com'));
  });
  it('distributes different keys across the palette (not all identical)', () => {
    const colors = ['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com'].map(presenceColor);
    expect(new Set(colors).size).toBeGreaterThan(1);
  });
});
