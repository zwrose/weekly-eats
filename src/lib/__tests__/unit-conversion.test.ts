import { describe, it, expect } from 'vitest';
import {
  toConvertUnit,
  areSameFamily,
  tryConvert,
  pickBestUnit,
} from '../unit-conversion';

describe('unit-conversion', () => {
  describe('toConvertUnit', () => {
    it('maps volume units to convert library identifiers', () => {
      expect(toConvertUnit('cup')).toBe('cups');
      expect(toConvertUnit('tablespoon')).toBe('tablespoons');
      expect(toConvertUnit('teaspoon')).toBe('teaspoons');
      expect(toConvertUnit('fluid ounce')).toBe('fl oz');
      expect(toConvertUnit('pint')).toBe('pints');
      expect(toConvertUnit('quart')).toBe('quarts');
      expect(toConvertUnit('gallon')).toBe('gallons');
      expect(toConvertUnit('milliliter')).toBe('milliliters');
      expect(toConvertUnit('liter')).toBe('liters');
    });

    it('maps weight units to convert library identifiers', () => {
      expect(toConvertUnit('gram')).toBe('grams');
      expect(toConvertUnit('kilogram')).toBe('kilograms');
      expect(toConvertUnit('ounce')).toBe('ounces');
      expect(toConvertUnit('pound')).toBe('pounds');
    });

    it('returns null for non-convertible units', () => {
      expect(toConvertUnit('can')).toBeNull();
      expect(toConvertUnit('bag')).toBeNull();
      expect(toConvertUnit('piece')).toBeNull();
      expect(toConvertUnit('slice')).toBeNull();
      expect(toConvertUnit('bunch')).toBeNull();
      expect(toConvertUnit('each')).toBeNull();
      expect(toConvertUnit('jar')).toBeNull();
      expect(toConvertUnit('bottle')).toBeNull();
      expect(toConvertUnit('head')).toBeNull();
      expect(toConvertUnit('clove')).toBeNull();
    });

    it('returns null for unknown units', () => {
      expect(toConvertUnit('foobar')).toBeNull();
      expect(toConvertUnit('')).toBeNull();
    });
  });

  describe('areSameFamily', () => {
    it('returns true for same-family volume pairs', () => {
      expect(areSameFamily('cup', 'gallon')).toBe(true);
      expect(areSameFamily('tablespoon', 'teaspoon')).toBe(true);
      expect(areSameFamily('pint', 'quart')).toBe(true);
      expect(areSameFamily('milliliter', 'liter')).toBe(true);
      expect(areSameFamily('cup', 'fluid ounce')).toBe(true);
    });

    it('returns true for same-family weight pairs', () => {
      expect(areSameFamily('ounce', 'pound')).toBe(true);
      expect(areSameFamily('gram', 'kilogram')).toBe(true);
      expect(areSameFamily('gram', 'ounce')).toBe(true);
    });

    it('returns false for cross-family pairs (volume vs weight)', () => {
      expect(areSameFamily('cup', 'pound')).toBe(false);
      expect(areSameFamily('liter', 'gram')).toBe(false);
    });

    it('returns false when either unit is non-convertible', () => {
      expect(areSameFamily('can', 'bag')).toBe(false);
      expect(areSameFamily('cup', 'can')).toBe(false);
      expect(areSameFamily('piece', 'pound')).toBe(false);
    });

    it('returns true for same unit', () => {
      expect(areSameFamily('cup', 'cup')).toBe(true);
      expect(areSameFamily('pound', 'pound')).toBe(true);
    });
  });

  describe('tryConvert', () => {
    it('converts between volume units', () => {
      const result = tryConvert(2, 'cup', 'tablespoon');
      expect(result).toBeCloseTo(32, 1);
    });

    it('converts between weight units', () => {
      const result = tryConvert(1, 'pound', 'ounce');
      expect(result).toBeCloseTo(16, 1);
    });

    it('converts pints to cups', () => {
      const result = tryConvert(1, 'pint', 'cup');
      expect(result).toBeCloseTo(2, 1);
    });

    it('returns null for non-convertible pairs', () => {
      expect(tryConvert(2, 'cup', 'pound')).toBeNull();
      expect(tryConvert(2, 'can', 'bag')).toBeNull();
      expect(tryConvert(2, 'cup', 'can')).toBeNull();
    });

    it('handles zero quantity', () => {
      expect(tryConvert(0, 'cup', 'tablespoon')).toBeCloseTo(0);
    });

    it('same-unit conversion returns the same quantity', () => {
      expect(tryConvert(5, 'cup', 'cup')).toBeCloseTo(5);
    });
  });

  describe('pickBestUnit', () => {
    it('picks a human-readable unit for large volume quantities', () => {
      // 2000 teaspoons should convert to something larger
      const result = pickBestUnit(2000, 'teaspoon');
      expect(result.quantity).toBeGreaterThan(0);
      expect(result.quantity).toBeLessThan(200);
      // Should not remain as teaspoon
      expect(result.unit).not.toBe('teaspoon');
    });

    it('picks a human-readable unit for large weight quantities', () => {
      // 2000 grams → ~4.4 lb (imperial best)
      const result = pickBestUnit(2000, 'gram');
      expect(result.quantity).toBeCloseTo(4.41, 0);
      expect(result.unit).toBe('pound');
    });

    it('converts small volumes to imperial best unit', () => {
      // 2 cups → 1 pint (imperial best)
      const result = pickBestUnit(2, 'cup');
      expect(result.quantity).toBeCloseTo(1, 1);
      expect(result.unit).toBe('pint');
    });

    it('returns original for non-convertible units', () => {
      const result = pickBestUnit(5, 'can');
      expect(result.quantity).toBe(5);
      expect(result.unit).toBe('can');
    });

    it('returns original for unknown units', () => {
      const result = pickBestUnit(3, 'foobar');
      expect(result.quantity).toBe(3);
      expect(result.unit).toBe('foobar');
    });

    it('handles zero quantity', () => {
      const result = pickBestUnit(0, 'cup');
      expect(result.quantity).toBe(0);
      expect(result.unit).toBe('cup');
    });

    it('converts 48 tablespoons to pints (imperial best)', () => {
      // 48 tablespoons → 1.5 pints (imperial best)
      const result = pickBestUnit(48, 'tablespoon');
      expect(result.unit).toBe('pint');
      expect(result.quantity).toBeCloseTo(1.5, 1);
    });
  });
});
