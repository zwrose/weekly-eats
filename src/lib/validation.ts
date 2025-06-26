import { DayOfWeek, MealType } from '../types/meal-plan';

/**
 * Valid day of week values
 */
export const VALID_DAYS_OF_WEEK: DayOfWeek[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
];

/**
 * Valid meal types
 */
export const VALID_MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];

/**
 * Check if a string is a valid day of week
 */
export const isValidDayOfWeek = (day: string): day is DayOfWeek => {
  return VALID_DAYS_OF_WEEK.includes(day as DayOfWeek);
};

/**
 * Check if a meals object has valid structure
 */
export const isValidMealsConfig = (meals: unknown): meals is Record<MealType, boolean> => {
  if (!meals || typeof meals !== 'object') {
    return false;
  }

  return VALID_MEAL_TYPES.every(mealType => 
    typeof (meals as Record<string, unknown>)[mealType] === 'boolean'
  );
};

/**
 * Validate a date string is in YYYY-MM-DD format
 */
export const isValidDateString = (dateString: string): boolean => {
  if (!dateString || typeof dateString !== 'string') {
    return false;
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return false;
  }

  const date = new Date(dateString);
  return !isNaN(date.getTime());
};

/**
 * Validate that a user ID is a valid MongoDB ObjectId string
 */
export const isValidObjectId = (id: string): boolean => {
  if (!id || typeof id !== 'string') {
    return false;
  }

  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  return objectIdRegex.test(id);
};

/**
 * Validate required fields in an object
 */
export const validateRequiredFields = <T extends Record<string, unknown>>(
  obj: T, 
  requiredFields: (keyof T)[]
): { isValid: boolean; missingFields: (keyof T)[] } => {
  const missingFields = requiredFields.filter(field => 
    obj[field] === undefined || obj[field] === null || obj[field] === ''
  );

  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}; 