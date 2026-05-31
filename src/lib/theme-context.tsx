'use client';

import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { darkTheme } from './theme';

// Light mode is dropped (plumbing preserved elsewhere: User.theme field + ThemeMode type stay).
// This wrapper is intentionally thin — always dark, no toggle, no settings fetch, no cookies.
export function ThemeProviderWrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider theme={darkTheme}>{children}</ThemeProvider>;
}
