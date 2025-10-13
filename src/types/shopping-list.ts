export interface StoreInvitation {
  userId: string;
  userEmail: string;
  status: 'pending' | 'accepted' | 'rejected';
  invitedBy: string; // userId of the inviter
  invitedAt: Date;
}

export interface Store {
  _id: string;
  userId: string; // The user who created/owns the store
  name: string;
  emoji?: string;
  invitations?: StoreInvitation[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ShoppingListItem {
  foodItemId: string;
  name: string; // Populated from food item
  quantity: number;
  unit: string;
  checked: boolean; // For marking items as completed
}

export interface ShoppingList {
  _id: string;
  storeId: string;
  userId: string;
  items: ShoppingListItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStoreRequest {
  name: string;
  emoji?: string;
}

export interface UpdateStoreRequest {
  name?: string;
  emoji?: string;
}

export interface UpdateShoppingListRequest {
  items: ShoppingListItem[];
}

export interface StoreWithShoppingList extends Store {
  shoppingList: ShoppingList;
}

