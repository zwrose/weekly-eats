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
      const newRecipe = await createRecipe(recipe);
      setUserRecipes(prev => [newRecipe, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create recipe');
      throw err;
    }
  }, []);

  const handleUpdateRecipe = useCallback(async (id: string, recipe: UpdateRecipeRequest) => {
    const updateInList = (list: Recipe[]) =>
      list.map(r => r._id === id ? { ...r, ...recipe } as Recipe : r);
    const prevUser = userRecipes;
    const prevGlobal = globalRecipes;

    // Optimistic update
    setUserRecipes(updateInList);
    setGlobalRecipes(updateInList);

    try {
      const updated = await updateRecipe(id, recipe);
      // Replace with server response to ensure consistency
      setUserRecipes(prev => prev.map(r => r._id === id ? updated : r));
      setGlobalRecipes(prev => prev.map(r => r._id === id ? updated : r));
    } catch (err) {
      // Revert on failure
      setUserRecipes(prevUser);
      setGlobalRecipes(prevGlobal);
      setError(err instanceof Error ? err.message : 'Failed to update recipe');
      throw err;
    }
  }, [userRecipes, globalRecipes]);

  const handleDeleteRecipe = useCallback(async (id: string) => {
    const prevUser = userRecipes;
    const prevGlobal = globalRecipes;

    // Optimistic removal
    setUserRecipes(prev => prev.filter(r => r._id !== id));
    setGlobalRecipes(prev => prev.filter(r => r._id !== id));

    try {
      await deleteRecipe(id);
    } catch (err) {
      // Revert on failure
      setUserRecipes(prevUser);
      setGlobalRecipes(prevGlobal);
      setError(err instanceof Error ? err.message : 'Failed to delete recipe');
      throw err;
    }
  }, [userRecipes, globalRecipes]);

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