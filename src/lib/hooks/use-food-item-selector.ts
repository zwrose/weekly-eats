/**
 * Core hook for food item and recipe selection
 * 
 * Extracted from IngredientInput to provide consistent behavior across all
 * food item selection use cases.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

export interface FoodItem {
  _id: string;
  name: string;
  singularName: string;
  pluralName: string;
  unit: string;
  isGlobal?: boolean;
}

export interface Recipe {
  _id: string;
  title: string;
  emoji?: string;
}

export type SearchOption = (FoodItem & { type: 'foodItem' }) | (Recipe & { type: 'recipe' });

export interface UseFoodItemSelectorOptions {
  allowRecipes?: boolean;
  excludeIds?: string[];
  foodItems?: FoodItem[];
  recipes?: Recipe[];
  currentRecipeId?: string;
  autoLoad?: boolean; // Whether to load data automatically if not provided
  onCreateRequested?: (inputValue: string) => void; // Callback when user wants to create a new item
}

export interface UseFoodItemSelectorReturn {
  // State
  inputValue: string;
  options: SearchOption[];
  selectedItem: SearchOption | null;
  isLoading: boolean;
  selectedIndex: number;
  
  // Actions
  setInputValue: (value: string) => void;
  handleSelect: (item: SearchOption | null) => void;
  handleInputChange: (value: string, reason: string) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  
  // Refs for focus management
  autocompleteRef: React.RefObject<HTMLInputElement | null>;
  quantityRef: React.RefObject<HTMLInputElement | null>;
}

const DEBOUNCE_DELAY = 750;

export function useFoodItemSelector(
  options: UseFoodItemSelectorOptions = {}
): UseFoodItemSelectorReturn {
  const {
    allowRecipes = true,
    excludeIds = [],
    foodItems: propFoodItems,
    recipes: propRecipes,
    currentRecipeId,
    autoLoad = true,
    onCreateRequested,
  } = options;

  // State
  const [inputValue, setInputValue] = useState('');
  const [searchOptions, setSearchOptions] = useState<SearchOption[]>([]);
  const [selectedItem, setSelectedItem] = useState<SearchOption | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Local data state (used when autoLoad=true and no props provided)
  const [localFoodItems, setLocalFoodItems] = useState<FoodItem[]>([]);
  const [localRecipes, setLocalRecipes] = useState<Recipe[]>([]);

  // Refs
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const autocompleteRef = useRef<HTMLInputElement | null>(null);
  const quantityRef = useRef<HTMLInputElement | null>(null);

  // Use prop data if provided, otherwise use local data
  const foodItems = propFoodItems || localFoodItems;
  const recipes = useMemo(() => {
    return allowRecipes ? (propRecipes || localRecipes) : [];
  }, [allowRecipes, propRecipes, localRecipes]);

  // Load data if autoLoad is enabled and no props provided
  useEffect(() => {
    if (!autoLoad || propFoodItems !== undefined) {
      return;
    }

    const loadData = async () => {
      try {
        const [foodRes, recipeRes] = await Promise.all([
          fetch('/api/food-items?limit=1000'),
          allowRecipes ? fetch('/api/recipes?limit=1000') : Promise.resolve({ ok: false, json: async () => [] }),
        ]);
        const foodItemsJson = foodRes.ok ? await foodRes.json() : { data: [] };
        const recipesJson = recipeRes.ok ? await recipeRes.json() : { data: [] };
        setLocalFoodItems(Array.isArray(foodItemsJson) ? foodItemsJson : foodItemsJson.data || []);
        if (allowRecipes) {
          setLocalRecipes(Array.isArray(recipesJson) ? recipesJson : recipesJson.data || []);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, [autoLoad, propFoodItems, allowRecipes]);

  // Perform search with debouncing
  const performSearch = useCallback(async (input: string) => {
    setIsLoading(true);
    setInputValue(input);
    setSelectedIndex(0);

    // Clear existing timeout
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(async () => {
      if (!input.trim()) {
        // If no input, show all available items (excluding selected ones)
        const allOptions: SearchOption[] = [
          ...foodItems.map(item => ({ ...item, type: 'foodItem' as const })),
          ...recipes.map(item => ({ ...item, type: 'recipe' as const })),
        ];
        const filtered = allOptions.filter(option =>
          !excludeIds.includes(option._id || '') &&
          !(currentRecipeId && option.type === 'recipe' && option._id === currentRecipeId)
        );
          setSearchOptions(filtered);
        setIsLoading(false);
        return;
      }

      try {
        // Determine if we should use local filtering or API search
        // Use local filtering if:
        // 1. Props are provided AND have data, OR
        // 2. Props are provided but empty AND autoLoad is false (intentionally empty)
        // Use API search if:
        // 1. Props are not provided (undefined), OR
        // 2. Props are provided but empty AND autoLoad is true (still loading)
        const hasFoodItemsData = propFoodItems !== undefined && propFoodItems.length > 0;
        const hasRecipesData = propRecipes !== undefined && propRecipes.length > 0;
        const foodItemsProvidedButEmpty = propFoodItems !== undefined && propFoodItems.length === 0;
        const recipesProvidedButEmpty = propRecipes !== undefined && propRecipes.length === 0;
        
        // If we have data in any prop, use local filtering
        // If props are provided but empty, use API search only if autoLoad is true (treating as "still loading")
        const shouldUseLocalFiltering = 
          hasFoodItemsData || 
          hasRecipesData || 
          (foodItemsProvidedButEmpty && !autoLoad) ||
          (recipesProvidedButEmpty && !autoLoad);
        
        if (shouldUseLocalFiltering) {
          // Local filtering
          const inputLower = input.toLowerCase();
          const filteredFoodItems = foodItems.filter(item =>
            item.name.toLowerCase().includes(inputLower) ||
            item.singularName.toLowerCase().includes(inputLower) ||
            item.pluralName.toLowerCase().includes(inputLower)
          );
          const filteredRecipes = recipes.filter(item =>
            item.title.toLowerCase().includes(inputLower)
          );

          const allOptions: SearchOption[] = [
            ...filteredFoodItems.map(item => ({ ...item, type: 'foodItem' as const })),
            ...filteredRecipes.map(item => ({ ...item, type: 'recipe' as const })),
          ];
          const filtered = allOptions.filter(option =>
            !excludeIds.includes(option._id || '') &&
            !(currentRecipeId && option.type === 'recipe' && option._id === currentRecipeId)
          );
          setSearchOptions(filtered);
          setIsLoading(false);
        } else {
          // API search
          const [foodRes, recipeRes] = await Promise.all([
            fetch(`/api/food-items?query=${encodeURIComponent(input)}&limit=20`),
            allowRecipes
              ? fetch(`/api/recipes?query=${encodeURIComponent(input)}&limit=20`)
              : Promise.resolve({ ok: false, json: async () => [] }),
          ]);
          const foodItemsData = foodRes.ok ? await foodRes.json() : [];
          const recipesData = recipeRes.ok ? await recipeRes.json() : [];

          // Filter out items that don't actually match
          const inputLower = input.toLowerCase();
          const filteredFoodItems = foodItemsData.filter((item: FoodItem) =>
            item.name.toLowerCase().includes(inputLower) ||
            item.singularName.toLowerCase().includes(inputLower) ||
            item.pluralName.toLowerCase().includes(inputLower)
          );
          const filteredRecipes = recipesData.filter((item: Recipe) =>
            item.title.toLowerCase().includes(inputLower)
          );

          const allOptions: SearchOption[] = [
            ...filteredFoodItems.map((item: FoodItem) => ({ ...item, type: 'foodItem' as const })),
            ...filteredRecipes.map((item: Recipe) => ({ ...item, type: 'recipe' as const })),
          ];
          const filtered = allOptions.filter(option =>
            !excludeIds.includes(option._id || '') &&
            !(currentRecipeId && option.type === 'recipe' && option._id === currentRecipeId)
          );
          setSearchOptions(filtered);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error performing search:', error);
        setSearchOptions([]);
        setIsLoading(false);
      }
    }, DEBOUNCE_DELAY);
  }, [foodItems, recipes, excludeIds, currentRecipeId, allowRecipes, propFoodItems, propRecipes, autoLoad]);

  const handleInputChange = useCallback((value: string, reason: string) => {
    setInputValue(value);

    // Only trigger search on user input, not on reset/clear events
    if (reason === 'input') {
      performSearch(value);
    }
  }, [performSearch]);

  const handleSelect = useCallback((item: SearchOption | null) => {
    setSelectedItem(item);
    if (item) {
      // Clear the search when item is selected
      setInputValue('');
      setSearchOptions([]);
      setSelectedIndex(0);
    }
  }, []);


  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      // If there are search results, select the first one (or currently highlighted one)
      if (searchOptions.length > 0) {
        const selectedOption = searchOptions[selectedIndex || 0];
        if (selectedOption) {
          handleSelect(selectedOption);
          return;
        }
      }

      // If no search results and there's input, request creation
      if (inputValue && inputValue.trim() !== '') {
        if (onCreateRequested) {
          onCreateRequested(inputValue.trim());
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (searchOptions.length > 0) {
        const newIndex = Math.min((selectedIndex || 0) + 1, searchOptions.length - 1);
        setSelectedIndex(newIndex);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (searchOptions.length > 0) {
        const newIndex = Math.max((selectedIndex || 0) - 1, 0);
        setSelectedIndex(newIndex);
      }
    }
  }, [inputValue, searchOptions, selectedIndex, onCreateRequested, handleSelect]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, []);

  return {
    // State
    inputValue,
    options: searchOptions,
    selectedItem,
    isLoading,
    selectedIndex,

    // Actions
    setInputValue,
    handleSelect,
    handleInputChange,
    handleKeyDown,


    // Refs
    autocompleteRef,
    quantityRef,
  };
}

