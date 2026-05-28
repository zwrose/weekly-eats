'use client';

import { useEffect } from 'react';
import { tokens } from '../lib/design-tokens';

/**
 * Sets the theme-color meta tag for the OS/PWA status bar. Dark-only now
 * (light mode dropped); hard-coded to the dark surface base.
 */
export const ThemeColorMeta: React.FC = () => {
  useEffect(() => {
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', tokens.surface.base);
  }, []);

  return null;
};
