export interface RecipeIngredient {
  type: 'foodItem' | 'recipe';
  id: string; // foodItemId or recipeId
  quantity: number;
  unit?: string; // Only for food items, not for recipes
  name?: string; // Populated from API when fetching
}

export interface RecipeIngredientList {
  title?: string; // Optional title for sub-lists
  ingredients: RecipeIngredient[];
  isStandalone?: boolean; // Indicates if this is a standalone group (no title required)
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