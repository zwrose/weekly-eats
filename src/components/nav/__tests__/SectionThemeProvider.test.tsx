import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useTheme } from '@mui/material/styles';
import { tokens } from '@/lib/design-tokens';

const { useActiveSectionMock } = vi.hoisted(() => ({ useActiveSectionMock: vi.fn() }));
vi.mock('@/lib/hooks/use-active-section', () => ({ useActiveSection: useActiveSectionMock }));

import { SectionThemeProvider } from '../SectionThemeProvider';

function PrimaryProbe() {
  const theme = useTheme();
  return <span data-testid="primary">{theme.palette.primary.main}</span>;
}

beforeEach(() => useActiveSectionMock.mockReset());
afterEach(cleanup);

describe('SectionThemeProvider', () => {
  it('rebinds primary to the section accent', () => {
    useActiveSectionMock.mockReturnValue('recipes');
    const { getByTestId } = render(
      <SectionThemeProvider>
        <PrimaryProbe />
      </SectionThemeProvider>
    );
    expect(getByTestId('primary').textContent).toBe(tokens.section.recipes);
  });

  it('binds the utility accent on system pages (null section)', () => {
    useActiveSectionMock.mockReturnValue(null);
    const { getByTestId } = render(
      <SectionThemeProvider>
        <PrimaryProbe />
      </SectionThemeProvider>
    );
    expect(getByTestId('primary').textContent).toBe(tokens.accentUtility);
  });
});
