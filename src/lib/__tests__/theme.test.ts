import { describe, it, expect } from 'vitest';
import { darkTheme, responsiveDialogStyle } from '../theme';
import { tokens } from '../design-tokens';

describe('darkTheme', () => {
  it('is a dark palette wired to the surface + text tokens', () => {
    expect(darkTheme.palette.mode).toBe('dark');
    expect(darkTheme.palette.background.default).toBe(tokens.surface.base);
    expect(darkTheme.palette.background.paper).toBe(tokens.surface.raised);
    expect(darkTheme.palette.text.primary).toBe(tokens.text.primary);
    expect(darkTheme.palette.divider).toBe(tokens.border.subtle);
  });

  it('defaults primary to the plans section accent', () => {
    expect(darkTheme.palette.primary.main).toBe(tokens.section.plans);
  });

  it('exposes custom palette keys for sections, meals, and the utility accent', () => {
    expect(darkTheme.palette.section.shop).toBe(tokens.section.shop);
    expect(darkTheme.palette.mealColor.dinner).toBe(tokens.meal.dinner);
    expect(darkTheme.palette.accentUtility).toBe(tokens.accentUtility);
  });

  it('maps semantic state colors', () => {
    expect(darkTheme.palette.success.main).toBe(tokens.state.success);
    expect(darkTheme.palette.error.main).toBe(tokens.state.danger);
    expect(darkTheme.palette.warning.main).toBe(tokens.state.warn);
  });

  it('registers a custom typography variant', () => {
    expect(darkTheme.typography.displayLg.fontSize).toBe('30px');
  });

  it('applies tabular-nums app-wide via the CssBaseline body override', () => {
    const body = darkTheme.components?.MuiCssBaseline?.styleOverrides?.body as
      | { fontVariantNumeric?: string }
      | undefined;
    expect(body?.fontVariantNumeric).toBe('tabular-nums');
  });

  it('still exports responsiveDialogStyle (16 consumers depend on it)', () => {
    expect(responsiveDialogStyle['& .MuiDialog-paper']).toBeDefined();
  });
});
