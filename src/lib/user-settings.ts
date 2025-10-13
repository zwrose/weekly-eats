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

export interface UserSettings {
  themeMode: ThemeMode;
  mealPlanSharing?: MealPlanSharing;
  defaultMealPlanOwner?: string; // User ID of the default owner for creating meal plans
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  themeMode: 'system',
  mealPlanSharing: {
    invitations: []
  },
  defaultMealPlanOwner: undefined // Will default to the current user if not set
}; 