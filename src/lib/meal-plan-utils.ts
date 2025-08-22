import { 
  MealPlanTemplate, 
  CreateMealPlanRequest, 
  CreateMealPlanTemplateRequest,
  UpdateMealPlanRequest,
  UpdateMealPlanTemplateRequest,
  MealPlanWithTemplate,
  DayOfWeek,
  MealPlan
} from '../types/meal-plan';
import { parseLocalDate, calculateEndDateAsString, formatDateForAPI, dayOfWeekToIndex } from './date-utils';
import { isBefore, isEqual, addDays } from 'date-fns';

// Default template values - centralized for DRY principle
export const DEFAULT_TEMPLATE: CreateMealPlanTemplateRequest = {
  startDay: 'saturday',
  meals: {
    breakfast: true,
    lunch: true,
    dinner: true,
    staples: false // Staples are managed separately, not as a regular meal
  },
  weeklyStaples: []
};

/**
 * Check if a meal plan date range overlaps with any existing meal plans
 * @param startDate - Start date of the new meal plan (YYYY-MM-DD)
 * @param existingPlans - Array of existing meal plans to check against
 * @param excludePlanId - Optional plan ID to exclude from checking (for updates)
 * @returns Object with isOverlapping boolean and conflict details if found
 */
export const checkMealPlanOverlap = (
  startDate: string,
  existingPlans: MealPlan[],
  excludePlanId?: string
): { isOverlapping: boolean; conflict?: { planName: string; startDate: string; endDate: string } } => {
  if (!startDate) {
    return { isOverlapping: false };
  }

  const newStart = parseLocalDate(startDate);
  const newEnd = parseLocalDate(calculateEndDateAsString(startDate));

  for (const plan of existingPlans) {
    // Skip the plan being updated (if provided)
    if (excludePlanId && plan._id === excludePlanId) {
      continue;
    }

    // Enforce string-only logic
    if (typeof plan.startDate !== 'string' || typeof plan.endDate !== 'string') {
      throw new Error('MealPlan startDate/endDate must be strings in YYYY-MM-DD format.');
    }
    const planStart = parseLocalDate(plan.startDate);
    const planEnd = parseLocalDate(plan.endDate);

    // If ranges overlap: (A <= D && C <= B)
    if (
      (isBefore(newStart, planEnd) || isEqual(newStart, planEnd)) &&
      (isBefore(planStart, newEnd) || isEqual(planStart, newEnd))
    ) {
      return {
        isOverlapping: true,
        conflict: {
          planName: plan.name,
          startDate: plan.startDate,
          endDate: plan.endDate
        }
      };
    }
  }

  return { isOverlapping: false };
};

// Meal Plan Templates
export const fetchMealPlanTemplate = async (): Promise<MealPlanTemplate | null> => {
  const response = await fetch('/api/meal-plans/template');
  if (!response.ok) {
    throw new Error('Failed to fetch meal plan template');
  }
  return response.json();
};

export const createMealPlanTemplate = async (template: CreateMealPlanTemplateRequest): Promise<MealPlanTemplate> => {
  const response = await fetch('/api/meal-plans/template', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(template),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create meal plan template');
  }
  
  return response.json();
};

export const updateMealPlanTemplate = async (template: UpdateMealPlanTemplateRequest): Promise<MealPlanTemplate> => {
  const response = await fetch('/api/meal-plans/template', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(template),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update meal plan template');
  }
  
  return response.json();
};

// Meal Plans
export const fetchMealPlans = async (): Promise<MealPlanWithTemplate[]> => {
  const response = await fetch('/api/meal-plans');
  if (!response.ok) {
    throw new Error('Failed to fetch meal plans');
  }
  return response.json();
};

export const fetchMealPlan = async (id: string): Promise<MealPlanWithTemplate> => {
  const response = await fetch(`/api/meal-plans/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch meal plan');
  }
  return response.json();
};

export const createMealPlan = async (mealPlan: CreateMealPlanRequest): Promise<MealPlanWithTemplate> => {
  const response = await fetch('/api/meal-plans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(mealPlan),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create meal plan');
  }
  
  return response.json();
};

export const updateMealPlan = async (id: string, mealPlan: UpdateMealPlanRequest): Promise<MealPlanWithTemplate> => {
  const response = await fetch(`/api/meal-plans/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(mealPlan),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update meal plan');
  }
  
  return response.json();
};

export const deleteMealPlan = async (id: string): Promise<void> => {
  const response = await fetch(`/api/meal-plans/${id}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete meal plan');
  }
};

// Helper functions
export const getDayOfWeek = (date: Date): DayOfWeek => {
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
};

export const getWeekDates = (startDate: Date): Date[] => {
  const dates: Date[] = [];
  const start = new Date(startDate);
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date);
  }
  
  return dates;
};

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
};

export const formatDateFull = (date: Date): string => {
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  });
};

// Helper function to get or create default template
export const getOrCreateDefaultTemplate = async (): Promise<MealPlanTemplate> => {
  try {
    const existingTemplate = await fetchMealPlanTemplate();
    if (existingTemplate) {
      return existingTemplate;
    }
  } catch {
    // Template doesn't exist, create default
  }
  
  // Create default template using centralized constant
  return await createMealPlanTemplate(DEFAULT_TEMPLATE);
};

/**
 * Find the next available non-overlapping start date for a meal plan
 * @param startDay - DayOfWeek string (e.g., 'saturday')
 * @param existingPlans - Array of existing meal plans
 * @returns { startDate: string, skipped: boolean, skippedFrom?: string }
 */
export function findNextAvailableMealPlanStartDate(
  startDay: DayOfWeek,
  existingPlans: MealPlan[]
): { startDate: string; skipped: boolean; skippedFrom?: string } {
  let candidate = new Date();
  const targetDayIndex = dayOfWeekToIndex(startDay);
  // Find the next occurrence of the template start day
  while (candidate.getDay() !== targetDayIndex) {
    candidate = addDays(candidate, 1);
  }
  let candidateStr = formatDateForAPI(candidate);
  let skipped = false;
  let skippedFrom: string | undefined = undefined;
  
  // If the first candidate overlaps, keep advancing until we find a free slot
  while (checkMealPlanOverlap(candidateStr, existingPlans).isOverlapping) {
    if (!skipped) {
      skipped = true;
      skippedFrom = candidateStr;
    }
    
    // Find the conflicting plan and advance to the day after it ends
    const overlapResult = checkMealPlanOverlap(candidateStr, existingPlans);
    if (overlapResult.conflict) {
      const conflictEndDate = parseLocalDate(overlapResult.conflict.endDate);
      // Advance to the day after the conflict ends, then find the next occurrence of the target day
      candidate = addDays(conflictEndDate, 1);
      while (candidate.getDay() !== targetDayIndex) {
        candidate = addDays(candidate, 1);
      }
      candidateStr = formatDateForAPI(candidate);
    } else {
      // Fallback: advance by 7 days
      candidate = addDays(candidate, 7);
      candidateStr = formatDateForAPI(candidate);
    }
  }
  
  return { startDate: candidateStr, skipped, skippedFrom };
} 