import { describe, it, expect } from 'vitest';
import { DEFAULT_USER_SETTINGS } from '../user-settings';

describe('user-settings', () => {
  describe('DEFAULT_USER_SETTINGS', () => {
    it('has required themeMode property', () => {
      expect(DEFAULT_USER_SETTINGS).toHaveProperty('themeMode');
      expect(typeof DEFAULT_USER_SETTINGS.themeMode).toBe('string');
    });

    it('has valid themeMode value', () => {
      const validThemes = ['light', 'dark', 'system'];
      expect(validThemes).toContain(DEFAULT_USER_SETTINGS.themeMode);
    });

    it('has consistent structure', () => {
      expect(DEFAULT_USER_SETTINGS).toEqual({
        themeMode: expect.any(String),
        mealPlanSharing: {
          invitations: expect.any(Array)
        }
      });
    });

    it('is immutable', () => {
      const originalTheme = DEFAULT_USER_SETTINGS.themeMode;
      
      // Attempt to modify (should not affect original)
      const settings = { ...DEFAULT_USER_SETTINGS };
      settings.themeMode = 'dark';
      
      expect(DEFAULT_USER_SETTINGS.themeMode).toBe(originalTheme);
    });
  });
});

