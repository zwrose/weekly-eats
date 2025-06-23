export interface PantryItem {
  _id: string;
  foodItemId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePantryItemRequest {
  foodItemId: string;
}

export interface UpdatePantryItemRequest {
  quantity?: number;
  unit?: string;
  expirationDate?: string;
  notes?: string;
}

export interface PantryItemWithFoodItem extends PantryItem {
  foodItem: {
    _id: string;
    name: string;
    singularName: string;
    pluralName: string;
    unit?: string;
  };
} 