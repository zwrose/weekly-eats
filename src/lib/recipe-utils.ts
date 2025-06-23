import { Recipe, CreateRecipeRequest, UpdateRecipeRequest } from '../types/recipe';

export const fetchRecipes = async (): Promise<Recipe[]> => {
  const response = await fetch('/api/recipes');
  if (!response.ok) {
    throw new Error('Failed to fetch recipes');
  }
  return response.json();
};

export const fetchUserRecipes = async (): Promise<Recipe[]> => {
  const response = await fetch('/api/recipes?userOnly=true');
  if (!response.ok) {
    throw new Error('Failed to fetch user recipes');
  }
  return response.json();
};

export const fetchGlobalRecipes = async (excludeUserCreated: boolean = false): Promise<Recipe[]> => {
  const url = excludeUserCreated 
    ? '/api/recipes?globalOnly=true&excludeUserCreated=true'
    : '/api/recipes?globalOnly=true';
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch global recipes');
  }
  return response.json();
};

export const fetchRecipe = async (id: string): Promise<Recipe> => {
  const response = await fetch(`/api/recipes/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch recipe');
  }
  return response.json();
};

export const createRecipe = async (recipe: CreateRecipeRequest): Promise<Recipe> => {
  const response = await fetch('/api/recipes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(recipe),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create recipe');
  }
  
  return response.json();
};

export const updateRecipe = async (id: string, recipe: UpdateRecipeRequest): Promise<void> => {
  const response = await fetch(`/api/recipes/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(recipe),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update recipe');
  }
};

export const deleteRecipe = async (id: string): Promise<void> => {
  const response = await fetch(`/api/recipes/${id}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete recipe');
  }
}; 