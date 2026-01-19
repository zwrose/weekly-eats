export interface RecipeUserData {
  _id?: string;
  userId: string;        // User who owns this data
  recipeId: string;      // Recipe ID
  tags: string[];        // Array of tag strings
  rating?: number;       // Optional rating (1-5)
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRecipeUserDataRequest {
  tags?: string[];
  rating?: number;
}

export interface UpdateRecipeUserDataRequest {
  tags?: string[];
  rating?: number;
}

export interface RecipeUserDataResponse {
  tags: string[];
  rating?: number;
  sharedTags?: string[];
  sharedRatings?: Array<{ userId: string; userName?: string; userEmail: string; rating: number }>;
}


