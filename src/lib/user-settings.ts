export type ThemeMode = 'light' | 'dark' | 'system';

export interface MealPlanSharingInvitation {
  userId: string;
  userEmail: string;
  userName?: string;
  status: 'pending' | 'accepted' | 'rejected';
  invitedBy: string; // userId of the inviter
  invitedAt: Date;
}

export interface MealPlanSharing {
  invitations?: MealPlanSharingInvitation[];
}

export interface RecipeSharingInvitation {
  userId: string;
  userEmail: string;
  userName?: string;
  status: 'pending' | 'accepted' | 'rejected';
  invitedBy: string; // userId of the inviter
  invitedAt: Date;
  sharingTypes: ('tags' | 'ratings')[]; // What is being shared (can be both)
}

export interface RecipeSharing {
  invitations?: RecipeSharingInvitation[];
}

export interface UserSettings {
  themeMode: ThemeMode;
  mealPlanSharing?: MealPlanSharing;
  recipeSharing?: RecipeSharing;
  defaultMealPlanOwner?: string; // User ID of the default owner for creating meal plans
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  themeMode: 'system',
  mealPlanSharing: {
    invitations: [],
  },
  defaultMealPlanOwner: undefined, // Will default to the current user if not set
};
