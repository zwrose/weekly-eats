import { DayOfWeek } from '../types/meal-plan';

/**
 * Parse a date string (YYYY-MM-DD) into a Date object in local timezone
 * Avoids timezone conversion issues that occur with new Date(dateString)
 */
export const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Format a Date object to YYYY-MM-DD string for API calls
 */
export const formatDateForAPI = (date: Date): string => {
  return date.toISOString().slice(0, 10);
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
 * Get the next occurrence of a given day of the week
 * If today is the target day, returns today
 * Otherwise returns the next occurrence
 */
export const getNextDayOfWeek = (date: Date, dayOfWeek: number): Date => {
  const result = new Date(date);
  const currentDay = result.getDay();
  
  // If today is the target day, use today
  if (currentDay === dayOfWeek) {
    return result;
  }
  
  // Calculate days to add
  let daysToAdd = dayOfWeek - currentDay;
  if (daysToAdd <= 0) {
    daysToAdd += 7; // Move to next week
  }
  
  result.setDate(result.getDate() + daysToAdd);
  return result;
};

/**
 * Generate a meal plan name based on start date
 */
export const generateMealPlanName = (startDate: Date): string => {
  return `Week of ${startDate.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  })}`;
};

/**
 * Calculate end date (7 days from start date)
 */
export const calculateEndDate = (startDate: Date): Date => {
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6); // 7 days total
  return endDate;
}; 