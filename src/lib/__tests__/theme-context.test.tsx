import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));

vi.mock('@mui/material/styles', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mui-provider">{children}</div>
  ),
  createTheme: () => ({}),
}));

vi.mock('../theme', () => ({ darkTheme: {} }));

import { ThemeProviderWrapper } from '../theme-context';

describe('ThemeProviderWrapper (always dark)', () => {
  it('renders children inside the MUI ThemeProvider', () => {
    const { getByTestId, getByText } = render(
      <ThemeProviderWrapper>
        <span>hello</span>
      </ThemeProviderWrapper>
    );
    expect(getByTestId('mui-provider')).toBeInTheDocument();
    expect(getByText('hello')).toBeInTheDocument();
  });

  it('does not read /api/user/settings (no theme write path)', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(
      <ThemeProviderWrapper>
        <span>x</span>
      </ThemeProviderWrapper>
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
