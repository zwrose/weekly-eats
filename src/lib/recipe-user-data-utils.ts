import { RecipeUserDataResponse } from '@/types/recipe-user-data';

/**
 * Fetch recipe user data (tags and rating) for a specific recipe
 */
export async function fetchRecipeUserData(recipeId: string): Promise<RecipeUserDataResponse> {
  const response = await fetch(`/api/recipes/${recipeId}/user-data`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch recipe user data');
  }
  return response.json();
}

/**
 * Update tags for a recipe
 */
export async function updateRecipeTags(recipeId: string, tags: string[]): Promise<{ tags: string[] }> {
  const response = await fetch(`/api/recipes/${recipeId}/tags`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tags }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update recipe tags');
  }
  return response.json();
}

/**
 * Update rating for a recipe
 */
export async function updateRecipeRating(recipeId: string, rating: number): Promise<{ rating: number }> {
  const response = await fetch(`/api/recipes/${recipeId}/rating`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rating }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update recipe rating');
  }
  return response.json();
}

/**
 * Delete rating for a recipe
 */
export async function deleteRecipeRating(recipeId: string): Promise<void> {
  const response = await fetch(`/api/recipes/${recipeId}/rating`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete recipe rating');
  }
}

/**
 * Fetch all unique tags for the current user across all their recipes
 */
export async function fetchUserTags(): Promise<string[]> {
  const response = await fetch('/api/recipes/tags');
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch user tags');
  }
  const data = await response.json();
  return data.tags || [];
}

