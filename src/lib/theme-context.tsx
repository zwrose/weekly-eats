"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { lightTheme, darkTheme } from './theme';
import { useSession } from 'next-auth/react';
import { ThemeMode, DEFAULT_USER_SETTINGS } from './user-settings';

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function ThemeProviderWrapper({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_USER_SETTINGS.themeMode);
  const [isDark, setIsDark] = useState(false);

  // Load settings from database when user is authenticated
  useEffect(() => {
    if (session?.user?.email) {
      loadUserSettings();
    }
  }, [session?.user?.email]);

  // Listen for theme change events from settings page
  useEffect(() => {
    const handleThemeChange = (event: CustomEvent) => {
      setMode(event.detail);
    };

    window.addEventListener('themeChange', handleThemeChange as EventListener);
    return () => {
      window.removeEventListener('themeChange', handleThemeChange as EventListener);
    };
  }, []);

  const loadUserSettings = async () => {
    try {
      const response = await fetch('/api/user/settings');
      if (response.ok) {
        const data = await response.json();
        setMode(data.settings?.themeMode || DEFAULT_USER_SETTINGS.themeMode);
      }
    } catch (error) {
      console.error('Failed to load user settings:', error);
    }
  };

  useEffect(() => {
    // Determine if dark mode should be active
    let shouldBeDark = false;
    
    if (mode === 'system') {
      shouldBeDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else {
      shouldBeDark = mode === 'dark';
    }
    
    setIsDark(shouldBeDark);
  }, [mode]);

  useEffect(() => {
    // Listen for system theme changes
    if (mode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        setIsDark(e.matches);
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [mode]);

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ mode, setMode, isDark }}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
} 