/**
 * Standardized error messages for the application
 * This ensures consistency and makes error messages easier to maintain
 */

// Authentication & Authorization
export const AUTH_ERRORS = {
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  SESSION_EXPIRED: 'Session expired',
} as const;

// Meal Plans
export const MEAL_PLAN_ERRORS = {
  START_DATE_REQUIRED: 'Start date is required',
  INVALID_START_DATE: 'Invalid start date format',
  TEMPLATE_NOT_FOUND: 'Template not found',
  TEMPLATE_ALREADY_EXISTS: 'User already has a template',
  TEMPLATE_CREATION_FAILED: 'Failed to create template',
  MEAL_PLAN_NOT_FOUND: 'Meal plan not found',
  MEAL_PLAN_CREATION_FAILED: 'Failed to create meal plan',
  MEAL_PLAN_UPDATE_FAILED: 'Failed to update meal plan',
  MEAL_PLAN_DELETION_FAILED: 'Failed to delete meal plan',
} as const;

// Template Validation
export const TEMPLATE_ERRORS = {
  START_DAY_REQUIRED: 'Valid start day is required',
  MEALS_CONFIG_REQUIRED: 'Meals configuration is required',
  INVALID_MEALS_CONFIG: 'Invalid meals configuration',
  TEMPLATE_CREATION_FAILED: 'Failed to create template',
  TEMPLATE_NOT_FOUND: 'Template not found',
} as const;

// General API Errors
export const API_ERRORS = {
  INTERNAL_SERVER_ERROR: 'Internal server error',
  BAD_REQUEST: 'Bad request',
  NOT_FOUND: 'Not found',
  VALIDATION_FAILED: 'Validation failed',
} as const;

// Database Errors
export const DATABASE_ERRORS = {
  CONNECTION_FAILED: 'Database connection failed',
  QUERY_FAILED: 'Database query failed',
  INSERT_FAILED: 'Failed to insert record',
  UPDATE_FAILED: 'Failed to update record',
  DELETE_FAILED: 'Failed to delete record',
} as const;

// User Management
export const USER_ERRORS = {
  USER_NOT_FOUND: 'User not found',
  USER_ALREADY_EXISTS: 'User already exists',
  INVALID_USER_ID: 'Invalid user ID',
} as const;

// Helper function to create consistent error responses
export const createErrorResponse = (message: string, status: number = 500) => {
  return {
    error: message,
    status,
    timestamp: new Date().toISOString(),
  };
};

// Helper function to log errors consistently
export const logError = (context: string, error: unknown, additionalInfo?: Record<string, unknown>) => {
  console.error(`[${context}] Error:`, {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...additionalInfo,
    timestamp: new Date().toISOString(),
  });
}; 