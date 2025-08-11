export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type MealType = 'breakfast' | 'lunch' | 'dinner';

export interface MealPlanTemplate {
  _id: string;
  userId: string;
  startDay: DayOfWeek;
  meals: {
    [key in MealType]: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface MealPlanItem {
  _id: string;
  mealPlanId: string;
  dayOfWeek: DayOfWeek;
  mealType: MealType;
  items: MealItem[];
  notes?: string;
}

export interface MealItem {
  type: 'recipe' | 'foodItem';
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
}

export interface MealPlan {
  _id: string;
  userId: string;
  name: string;
  startDate: string; // YYYY-MM-DD format
  endDate: string; // YYYY-MM-DD format
  templateId: string;
  templateSnapshot: {
    startDay: DayOfWeek;
    meals: {
      [key in MealType]: boolean;
    };
  };
  items: MealPlanItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMealPlanTemplateRequest {
  startDay: DayOfWeek;
  meals: {
    [key in MealType]: boolean;
  };
}

export interface UpdateMealPlanTemplateRequest {
  startDay?: DayOfWeek;
  meals?: {
    [key in MealType]: boolean;
  };
}

export interface CreateMealPlanRequest {
  startDate: string; // ISO date string
}

export interface UpdateMealPlanRequest {
  name?: string;
  items?: MealPlanItem[];
}

export interface MealPlanWithTemplate extends MealPlan {
  template: MealPlanTemplate;
}

export interface MealPlanItemWithDetails extends MealPlanItem {
  items: (MealItem & {
    details?: {
      recipe?: {
        _id: string;
        title: string;
        emoji?: string;
      };
      foodItem?: {
        _id: string;
        name: string;
        unit: string;
      };
    };
  })[];
} 