import { 
  MealPlanTemplate, 
  CreateMealPlanRequest, 
  CreateMealPlanTemplateRequest,
  UpdateMealPlanRequest,
  UpdateMealPlanTemplateRequest,
  MealPlanWithTemplate,
  DayOfWeek
} from '../types/meal-plan';

// Default template values - centralized for DRY principle
export const DEFAULT_TEMPLATE: CreateMealPlanTemplateRequest = {
  startDay: 'saturday',
  meals: {
    breakfast: true,
    lunch: true,
    dinner: true
  }
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