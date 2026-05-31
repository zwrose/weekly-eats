import React from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { ThemeProvider, createTheme, type Theme } from '@mui/material/styles';
import { darkTheme } from '@/lib/theme';
import { tokens } from '@/lib/design-tokens';
import type { SectionKey } from '@/lib/nav-sections';

/**
 * Section themes: palette.primary bound to each section's accent, mirroring
 * SectionThemeProvider. Add entries as chunks need them.
 */
const sectionThemes: Partial<Record<SectionKey, Theme>> = {
  shop: createTheme(darkTheme, {
    palette: { primary: { main: tokens.section.shop, contrastText: tokens.surface.base } },
  }),
  pantry: createTheme(darkTheme, {
    palette: { primary: { main: tokens.section.pantry, contrastText: tokens.surface.base } },
  }),
};

interface RenderWithThemeOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Section accent to bind to `palette.primary`. Defaults to `'shop'`. */
  section?: SectionKey;
}

/**
 * RTL `render` wrapped in the app theme with `palette.primary` bound to a
 * section accent, mirroring how SectionThemeProvider rebinds primary per route.
 * Defaults to the shop section (`tokens.section.shop`) so existing callers are
 * unchanged; pass `{ section: 'pantry' }` for Pantry component tests.
 */
export function renderWithTheme(
  ui: React.ReactElement,
  options?: RenderWithThemeOptions
): RenderResult {
  const { section = 'shop', ...renderOptions } = options ?? {};
  const theme = sectionThemes[section] ?? sectionThemes.shop!;
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
  }
  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Returns a stub props object matching the handler names expected by
 * `ShoppingListView`. Pass the result directly into the component under test
 * and override individual handlers as needed.
 *
 * Handler names belong to the View layer; `ShoppingItemRow` receives narrowed
 * props (`onToggle`/`onEdit`) that the View maps internally — keep them distinct.
 *
 * `onSelectStore` is intentionally omitted so tests can pass an explicit spy
 * (`onSelectStore={fn} {...stubHandlers()}`) without the spread clobbering it.
 */
export function stubHandlers() {
  return {
    onToggleItem: () => {},
    onEditItem: () => {},
    onAddItem: () => {},
    onFinish: () => {},
    onBack: () => {},
    onReconnect: () => {},
    connectionState: 'connected' as const,
    activeUsers: [] as unknown[],
  };
}
