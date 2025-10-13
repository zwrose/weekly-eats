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

export async function deleteStore(id: string): Promise<{ success: boolean; sharedUserCount?: number }> {
  const response = await fetch(`/api/stores/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete store');
  }
  return response.json();
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

// Invitation management
export async function inviteUserToStore(storeId: string, email: string): Promise<void> {
  const response = await fetch(`/api/stores/${storeId}/invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to invite user');
  }
}

export async function respondToInvitation(storeId: string, userId: string, action: 'accept' | 'reject'): Promise<void> {
  const response = await fetch(`/api/stores/${storeId}/invitations/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Failed to ${action} invitation`);
  }
}

export async function removeUserFromStore(storeId: string, userId: string): Promise<void> {
  const response = await fetch(`/api/stores/${storeId}/invitations/${userId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to remove user from store');
  }
}

export async function fetchPendingInvitations(): Promise<Array<{
  storeId: string;
  storeName: string;
  storeEmoji?: string;
  invitation: {
    userId: string;
    userEmail: string;
    status: 'pending';
    invitedBy: string;
    invitedAt: Date;
  };
}>> {
  const response = await fetch('/api/stores/invitations');
  if (!response.ok) {
    throw new Error('Failed to fetch pending invitations');
  }
  return response.json();
}

