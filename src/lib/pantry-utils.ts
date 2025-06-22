import { PantryItem, CreatePantryItemRequest, PantryItemWithFoodItem } from '../types/pantry';

export const fetchPantryItems = async (): Promise<PantryItemWithFoodItem[]> => {
  const response = await fetch('/api/pantry');
  if (!response.ok) {
    throw new Error('Failed to fetch pantry items');
  }
  return response.json();
};

export const createPantryItem = async (pantryItem: CreatePantryItemRequest): Promise<PantryItem> => {
  const response = await fetch('/api/pantry', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(pantryItem),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create pantry item');
  }
  
  return response.json();
};

export const deletePantryItem = async (id: string): Promise<void> => {
  const response = await fetch(`/api/pantry/${id}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete pantry item');
  }
}; 