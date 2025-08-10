import { describe, it, expect } from 'vitest';
import { isValidDayOfWeek, isValidMealsConfig, isValidDateString, isValidObjectId, validateRequiredFields } from '../validation';

describe('validation', () => {
  it('validates day of week', () => {
    expect(isValidDayOfWeek('monday')).toBe(true);
    expect(isValidDayOfWeek('Mon')).toBe(false as any);
  });

  it('validates meals config', () => {
    expect(isValidMealsConfig({ breakfast: true, lunch: false, dinner: true })).toBe(true);
    expect(isValidMealsConfig({ breakfast: true, lunch: 'x', dinner: true } as any)).toBe(false);
  });

  it('validates date string format', () => {
    expect(isValidDateString('2024-01-01')).toBe(true);
    expect(isValidDateString('2024-13-40')).toBe(false);
  });

  it('validates Mongo ObjectId strings', () => {
    expect(isValidObjectId('64b7f8c2a2b7c2f1a2b7c2f1')).toBe(true);
    expect(isValidObjectId('not-an-id')).toBe(false);
  });

  it('validates required fields helper', () => {
    const { isValid, missingFields } = validateRequiredFields({ a: 1, b: '' }, ['a', 'b']);
    expect(isValid).toBe(false);
    expect(missingFields).toContain('b');
  });
});


