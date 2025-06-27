import { DayOfWeek } from '../types/meal-plan';
import { parseISO, format, addDays, startOfDay, getDay } from 'date-fns';

/**
 * Parse a date string (YYYY-MM-DD) into a Date object in local timezone
 * Uses date-fns parseISO for consistent parsing
 */
export const parseLocalDate = (dateString: string): Date => {
  return parseISO(dateString);
};

/**
 * Format a Date object to YYYY-MM-DD string for API calls
 * Uses date-fns format for consistent formatting
 */
export const formatDateForAPI = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

/**
 * Get today's date as YYYY-MM-DD string
 */
export const getTodayAsString = (): string => {
  return formatDateForAPI(new Date());
};

/**
 * Convert DayOfWeek string to JavaScript day index (0=Sunday, 1=Monday, etc.)
 */
export const dayOfWeekToIndex = (day: DayOfWeek): number => {
  switch (day) {
    case 'sunday': return 0;
    case 'monday': return 1;
    case 'tuesday': return 2;
    case 'wednesday': return 3;
    case 'thursday': return 4;
    case 'friday': return 5;
    case 'saturday': return 6;
    default: return 0;
  }
};

/**
 * Get the next occurrence of a given day of the week as YYYY-MM-DD string
 * If today is the target day, returns today
 * Otherwise returns the next occurrence
 */
export const getNextDayOfWeekAsString = (dayOfWeek: number): string => {
  const today = startOfDay(new Date());
  
  // If today is the target day, use today
  if (getDay(today) === dayOfWeek) {
    return formatDateForAPI(today);
  }
  
  // Calculate days to add
  let daysToAdd = dayOfWeek - getDay(today);
  if (daysToAdd <= 0) {
    daysToAdd += 7; // Move to next week
  }
  
  const nextDate = addDays(today, daysToAdd);
  return formatDateForAPI(nextDate);
};

/**
 * Get the next occurrence of a given day of the week
 * If today is the target day, returns today
 * Otherwise returns the next occurrence
 */
export const getNextDayOfWeek = (date: Date, dayOfWeek: number): Date => {
  const startDate = startOfDay(date);
  const currentDay = getDay(startDate);
  
  // If today is the target day, use today
  if (currentDay === dayOfWeek) {
    return startDate;
  }
  
  // Calculate days to add
  let daysToAdd = dayOfWeek - currentDay;
  if (daysToAdd <= 0) {
    daysToAdd += 7; // Move to next week
  }
  
  return addDays(startDate, daysToAdd);
};

/**
 * Generate a meal plan name based on start date string
 */
export const generateMealPlanNameFromString = (startDateString: string): string => {
  const date = parseLocalDate(startDateString);
  return `Week of ${format(date, 'MMMM d, yyyy')}`;
};

/**
 * Calculate end date (7 days from start date) as YYYY-MM-DD string
 */
export const calculateEndDateAsString = (startDateString: string): string => {
  const startDate = parseLocalDate(startDateString);
  const endDate = addDays(startDate, 6); // 7 days total
  return formatDateForAPI(endDate);
};

/**
 * Calculate end date (7 days from start date)
 */
export const calculateEndDate = (startDate: Date): Date => {
  return addDays(startDate, 6); // 7 days total
}; 