// src/components/nav/SectionThemeProvider.tsx
'use client';

import { useMemo } from 'react';
import { ThemeProvider, useTheme, createTheme } from '@mui/material/styles';
import { tokens } from '@/lib/design-tokens';
import { useActiveSection } from '@/lib/hooks/use-active-section';

/**
 * Rebinds palette.primary to the active section's accent so MUI components using
 * color="primary" resolve to the section color. System pages (no active section)
 * bind the cool-slate utility accent. Wired centrally from AuthenticatedLayout.
 */
export function SectionThemeProvider({ children }: { children: React.ReactNode }) {
  const base = useTheme();
  const section = useActiveSection();
  const accent = section ? tokens.section[section] : tokens.accentUtility;

  const theme = useMemo(
    () =>
      createTheme(base, {
        palette: { primary: { main: accent, contrastText: tokens.surface.base } },
      }),
    [base, accent]
  );

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
