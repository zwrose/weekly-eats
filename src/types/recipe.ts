export interface RecipeIngredient {
  foodItemId: string;
  quantity: number;
  unit: string;
}

export interface RecipeIngredientList {
  title?: string; // Optional title for sub-lists
  ingredients: RecipeIngredient[];
}

export interface Recipe {
  _id?: string;
  title: string;
  emoji?: string;
  ingredients: RecipeIngredientList[]; // Array of ingredient lists (single list or multiple sub-lists)
  instructions: string;
  isGlobal: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRecipeRequest {
  title: string;
  emoji?: string;
  ingredients: RecipeIngredientList[];
  instructions: string;
  isGlobal: boolean;
}

export interface UpdateRecipeRequest {
  title?: string;
  emoji?: string;
  ingredients?: RecipeIngredientList[];
  instructions?: string;
  isGlobal?: boolean;
} 