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
  APPROVAL_UPDATE_FAILED: 'Failed to update approval status',
  ADMIN_TOGGLE_FAILED: 'Failed to toggle admin status',
} as const;

// Food Items
export const FOOD_ITEM_ERRORS = {
  NAME_REQUIRED: 'Name is required',
  SINGULAR_NAME_REQUIRED: 'Singular name is required',
  PLURAL_NAME_REQUIRED: 'Plural name is required',
  UNIT_REQUIRED: 'Valid unit is required',
  INVALID_UNIT: 'Invalid unit specified',
  IS_GLOBAL_REQUIRED: 'isGlobal must be a boolean',
  FOOD_ITEM_NOT_FOUND: 'Food item not found',
  FOOD_ITEM_ALREADY_EXISTS: 'Food item already exists',
  FOOD_ITEM_CREATION_FAILED: 'Failed to create food item',
  FOOD_ITEM_UPDATE_FAILED: 'Failed to update food item',
  FOOD_ITEM_DELETION_FAILED: 'Failed to delete food item',
  INVALID_FOOD_ITEM_ID: 'Invalid food item ID',
  PERMISSION_DENIED: 'You do not have permission to perform this action',
  CANNOT_MAKE_GLOBAL_PERSONAL: 'Cannot make global items personal',
  ONLY_ADMINS_CAN_MAKE_GLOBAL: 'Only admins can make items global',
  ONLY_ADMINS_CAN_EDIT_GLOBAL: 'Only admins can edit global items',
} as const;

// Recipes
export const RECIPE_ERRORS = {
  TITLE_REQUIRED: 'Recipe title is required',
  INSTRUCTIONS_REQUIRED: 'Cooking instructions are required',
  INGREDIENTS_REQUIRED: 'At least one ingredient is required',
  INVALID_INGREDIENT_DATA: 'Invalid ingredient data',
  INGREDIENT_LIST_REQUIRED: 'Each ingredient list must have at least one ingredient',
  RECIPE_NOT_FOUND: 'Recipe not found',
  RECIPE_CREATION_FAILED: 'Failed to create recipe',
  RECIPE_UPDATE_FAILED: 'Failed to update recipe',
  RECIPE_DELETION_FAILED: 'Failed to delete recipe',
  INVALID_RECIPE_ID: 'Invalid recipe ID',
  NO_PERMISSION_TO_EDIT: 'Recipe not found or you do not have permission to edit it',
} as const;

// Pantry
export const PANTRY_ERRORS = {
  FOOD_ITEM_ID_REQUIRED: 'Food item ID is required',
  FOOD_ITEM_NOT_FOUND: 'Food item not found',
  ITEM_ALREADY_EXISTS: 'Item already exists in pantry',
  PANTRY_ITEM_CREATION_FAILED: 'Failed to create pantry item',
  PANTRY_ITEM_DELETION_FAILED: 'Failed to delete pantry item',
  PANTRY_ITEM_NOT_FOUND: 'Pantry item not found',
} as const;

// Settings
export const SETTINGS_ERRORS = {
  SETTINGS_FETCH_FAILED: 'Failed to fetch user settings',
  SETTINGS_UPDATE_FAILED: 'Failed to update user settings',
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