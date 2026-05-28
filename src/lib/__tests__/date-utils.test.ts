import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatDateForAPI,
  calculateEndDate,
  calculateEndDateAsString,
  generateMealPlanNameFromString,
  getNextDayOfWeek,
  dayOfWeekToIndex,
  getNextDayOfWeekAsString,
  getTodayAsString,
} from '../date-utils';
import type { DayOfWeek } from '../../types/meal-plan';

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

describe('dayOfWeekToIndex', () => {
  it.each([
    ['sunday', 0],
    ['monday', 1],
    ['tuesday', 2],
    ['wednesday', 3],
    ['thursday', 4],
    ['friday', 5],
    ['saturday', 6],
  ] as [DayOfWeek, number][])('maps %s to index %i', (day, expected) => {
    expect(dayOfWeekToIndex(day)).toBe(expected);
  });

  it('returns 0 for an invalid input', () => {
    expect(dayOfWeekToIndex('not-a-day' as DayOfWeek)).toBe(0);
  });
});

describe('getNextDayOfWeekAsString and getTodayAsString (fake timers)', () => {
  afterEach(() => vi.useRealTimers());

  it('returns today when today is the target day', () => {
    // 2024-03-01 is a Friday (getDay === 5)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-01T08:00:00'));

    expect(getNextDayOfWeekAsString(5)).toBe('2024-03-01');
  });

  it('wraps to next week (+7) when today is after the target day', () => {
    // Friday 2024-03-01; target is Thursday (4), which already passed this week
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-01T08:00:00'));

    expect(getNextDayOfWeekAsString(4)).toBe('2024-03-07');
  });

  it('getTodayAsString equals formatDateForAPI(new Date()) under a pinned clock', () => {
    vi.useFakeTimers();
    const now = new Date('2024-03-01T08:00:00');
    vi.setSystemTime(now);

    expect(getTodayAsString()).toBe(formatDateForAPI(new Date()));
    expect(getTodayAsString()).toBe('2024-03-01');
  });
});
