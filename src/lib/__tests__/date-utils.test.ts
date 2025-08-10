import { describe, it, expect, vi } from 'vitest';
import { formatDateForAPI, calculateEndDate, calculateEndDateAsString, generateMealPlanNameFromString, getNextDayOfWeek } from '../date-utils';

describe('date-utils', () => {
  it('formats date to API string yyyy-MM-dd', () => {
    const date = new Date('2024-02-29T12:34:56Z');
    expect(formatDateForAPI(date)).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('calculates end date 6 days ahead (7-day span)', () => {
    const start = new Date('2024-03-01T00:00:00Z');
    const end = calculateEndDate(start);
    expect(Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))).toBe(6);
  });

  it('calculates end date string from start date string', () => {
    expect(calculateEndDateAsString('2024-03-01')).toBe('2024-03-07');
  });

  it('generates meal plan name', () => {
    expect(generateMealPlanNameFromString('2024-03-01')).toContain('Week of');
  });

  it('gets next day of week or same day if already matching', () => {
    const date = new Date('2024-03-01T00:00:00Z'); // Friday
    const nextFri = getNextDayOfWeek(date, 5);
    expect(nextFri.getDay()).toBe(5);
    const nextSun = getNextDayOfWeek(date, 0);
    expect(nextSun.getDay()).toBe(0);
  });
});


