import { describe, it, expect } from 'vitest';
import { normalizeUnit, getUnitForm, getUnitAbbreviation, getUnitAbbreviationForm, getUnitOptions } from '../food-items-utils';

describe('food-items-utils', () => {
  it('normalizes unit variants to singular', () => {
    expect(normalizeUnit('grams')).toBe('gram');
    expect(normalizeUnit('g')).toBe('gram');
    expect(normalizeUnit('lb')).toBe('pound');
  });

  it('returns null for unknown units', () => {
    expect(normalizeUnit('unknown-unit')).toBeNull();
  });

  it('pluralizes based on quantity', () => {
    expect(getUnitForm('cup', 1)).toBe('cup');
    expect(getUnitForm('cup', 2)).toBe('cups');
  });

  it('handles new box and loaf units with correct pluralization and normalization', () => {
    expect(normalizeUnit('box')).toBe('box');
    expect(normalizeUnit('boxes')).toBe('box');
    expect(getUnitForm('box', 1)).toBe('box');
    expect(getUnitForm('box', 3)).toBe('boxes');

    expect(normalizeUnit('loaf')).toBe('loaf');
    expect(normalizeUnit('loaves')).toBe('loaf');
    expect(getUnitForm('loaf', 1)).toBe('loaf');
    expect(getUnitForm('loaf', 2)).toBe('loaves');
  });

  it('gets abbreviation for known unit', () => {
    expect(getUnitAbbreviation('teaspoon')).toBe('tsp');
  });

  it('gets plural abbreviation form when quantity != 1', () => {
    expect(getUnitAbbreviationForm('pound', 2)).toBe('lbs');
  });

  it('provides unit options list', () => {
    const options = getUnitOptions();
    expect(options.length).toBeGreaterThan(0);
    expect(options[0]).toHaveProperty('value');
    expect(options[0]).toHaveProperty('label');
  });
});


