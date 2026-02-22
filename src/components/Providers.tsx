'use client';

import { SessionProvider } from 'next-auth/react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProviderWrapper } from '../lib/theme-context';
import { ThemeColorMeta } from './ThemeColorMeta';
import type { ThemeMode } from '../lib/user-settings';

export default function Providers({
  children,
  initialMode,
  initialIsDark = false,
}: {
  children: React.ReactNode;
  initialMode?: ThemeMode;
  initialIsDark?: boolean;
}) {
  return (
    <SessionProvider>
      <ThemeProviderWrapper initialMode={initialMode} initialIsDark={initialIsDark}>
        <CssBaseline />
        <ThemeColorMeta />
        {children}
      </ThemeProviderWrapper>
    </SessionProvider>
  );
}
