import React from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { darkTheme } from '@/lib/theme';
import { tokens } from '@/lib/design-tokens';

/** Shop-section theme: palette.primary bound to the shop accent, mirroring SectionThemeProvider. */
const shopTheme = createTheme(darkTheme, {
  palette: {
    primary: { main: tokens.section.shop, contrastText: tokens.surface.base },
  },
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider theme={shopTheme}>{children}</ThemeProvider>;
}

/**
 * RTL `render` wrapped in the app theme with palette.primary bound to the shop
 * section accent (`tokens.section.shop`). Mirrors how SectionThemeProvider
 * rebinds primary on `/shopping-lists`.
 *
 * Use for all Shopping Lists component tests so MUI color assertions are
 * consistent with the live surface.
 */
export function renderWithTheme(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): RenderResult {
  return render(ui, { wrapper: Wrapper, ...options });
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
