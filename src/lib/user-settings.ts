export type ThemeMode = 'light' | 'dark' | 'system';

export interface UserSettings {
  themeMode: ThemeMode;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  themeMode: 'system',
}; 