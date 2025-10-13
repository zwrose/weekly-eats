"use client";

import { useEffect } from 'react';
import { useTheme } from '../lib/theme-context';

/**
 * Component that dynamically updates the theme-color meta tag
 * to match the current theme (light/dark mode) for PWA status bar
 */
export const ThemeColorMeta: React.FC = () => {
  const { isDark } = useTheme();

  useEffect(() => {
    // Update the theme-color meta tag for the OS status bar
    const themeColor = isDark ? '#121212' : '#f5f5f5';
    
    // Find existing meta tag or create a new one
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    
    metaThemeColor.setAttribute('content', themeColor);
  }, [isDark]);

  return null;
};

