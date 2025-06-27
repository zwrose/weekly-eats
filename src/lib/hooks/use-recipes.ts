import { useState, useEffect, useCallback } from 'react';
import { Recipe, CreateRecipeRequest, UpdateRecipeRequest } from '../../types/recipe';
import { createRecipe, deleteRecipe, updateRecipe, fetchUserRecipes, fetchGlobalRecipes } from '../recipe-utils';

interface UseRecipesReturn {
  userRecipes: Recipe[];
  globalRecipes: Recipe[];
  loading: boolean;
  userLoading: boolean;
  globalLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  refetchUser: () => Promise<void>;
  refetchGlobal: () => Promise<void>;
  createRecipe: (recipe: CreateRecipeRequest) => Promise<void>;
  updateRecipe: (id: string, recipe: UpdateRecipeRequest) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
}

export const useRecipes = (): UseRecipesReturn => {
  const [userRecipes, setUserRecipes] = useState<Recipe[]>([]);
  const [globalRecipes, setGlobalRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLoading, setUserLoading] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUserRecipes = useCallback(async () => {
    try {
      setUserLoading(true);
      const recipes = await fetchUserRecipes();
      setUserRecipes(recipes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user recipes');
      console.error('Error loading user recipes:', err);
    } finally {
      setUserLoading(false);
    }
  }, []);

  const loadGlobalRecipes = useCallback(async () => {
    try {
      setGlobalLoading(true);
      const recipes = await fetchGlobalRecipes(true); // Exclude user created
      setGlobalRecipes(recipes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load global recipes');
      console.error('Error loading global recipes:', err);
    } finally {
      setGlobalLoading(false);
    }
  }, []);

  const loadRecipes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([
        loadUserRecipes(),
        loadGlobalRecipes()
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recipes');
      console.error('Error loading recipes:', err);
    } finally {
      setLoading(false);
    }
  }, [loadUserRecipes, loadGlobalRecipes]);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  const handleCreateRecipe = useCallback(async (recipe: CreateRecipeRequest) => {
    try {
      await createRecipe(recipe);
      await loadRecipes(); // Refresh both lists
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create recipe');
      throw err;
    }
  }, [loadRecipes]);

  const handleUpdateRecipe = useCallback(async (id: string, recipe: UpdateRecipeRequest) => {
    try {
      await updateRecipe(id, recipe);
      await loadRecipes(); // Refresh both lists
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update recipe');
      throw err;
    }
  }, [loadRecipes]);

  const handleDeleteRecipe = useCallback(async (id: string) => {
    try {
      await deleteRecipe(id);
      await loadRecipes(); // Refresh both lists
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete recipe');
      throw err;
    }
  }, [loadRecipes]);

  return {
    userRecipes,
    globalRecipes,
    loading,
    userLoading,
    globalLoading,
    error,
    refetch: loadRecipes,
    refetchUser: loadUserRecipes,
    refetchGlobal: loadGlobalRecipes,
    createRecipe: handleCreateRecipe,
    updateRecipe: handleUpdateRecipe,
    deleteRecipe: handleDeleteRecipe
  };
}; 