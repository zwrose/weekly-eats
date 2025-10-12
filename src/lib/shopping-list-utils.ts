import { Store, ShoppingList, CreateStoreRequest, UpdateStoreRequest, UpdateShoppingListRequest, StoreWithShoppingList } from '../types/shopping-list';

export async function fetchStores(): Promise<StoreWithShoppingList[]> {
  const response = await fetch('/api/stores');
  if (!response.ok) {
    throw new Error('Failed to fetch stores');
  }
  return response.json();
}

export async function fetchStore(id: string): Promise<StoreWithShoppingList> {
  const response = await fetch(`/api/stores/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch store');
  }
  return response.json();
}

export async function createStore(data: CreateStoreRequest): Promise<StoreWithShoppingList> {
  const response = await fetch('/api/stores', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create store');
  }
  return response.json();
}

export async function updateStore(id: string, data: UpdateStoreRequest): Promise<Store> {
  const response = await fetch(`/api/stores/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update store');
  }
  return response.json();
}

export async function deleteStore(id: string): Promise<void> {
  const response = await fetch(`/api/stores/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete store');
  }
}

export async function fetchShoppingList(storeId: string): Promise<ShoppingList> {
  const response = await fetch(`/api/shopping-lists/${storeId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch shopping list');
  }
  return response.json();
}

export async function updateShoppingList(storeId: string, data: UpdateShoppingListRequest): Promise<ShoppingList> {
  const response = await fetch(`/api/shopping-lists/${storeId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update shopping list');
  }
  return response.json();
}

