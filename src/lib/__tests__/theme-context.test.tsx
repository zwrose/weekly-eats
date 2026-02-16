import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { useRef } from 'react';
import { render, waitFor, cleanup, act } from '@testing-library/react';

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));

// Mock MUI ThemeProvider to avoid complex setup
vi.mock('@mui/material/styles', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  createTheme: () => ({}),
}));

// Mock theme
vi.mock('../theme', () => ({
  lightTheme: {},
  darkTheme: {},
}));

// Mock user-settings
vi.mock('../user-settings', () => ({
  DEFAULT_USER_SETTINGS: { themeMode: 'light' },
}));

// Must import after mocks
import { ThemeProviderWrapper, useTheme } from '../theme-context';

// Track render count and context value reference stability
let contextValueRef: ReturnType<typeof useTheme> | null = null;
let previousValueRef: ReturnType<typeof useTheme> | null = null;
let renderCount = 0;
let valueChangedOnRerender = false;

const ContextValueTracker: React.FC = () => {
  renderCount++;
  const value = useTheme();

  if (renderCount > 1 && previousValueRef !== null) {
    // Check if the context value reference changed between renders
    valueChangedOnRerender = value !== previousValueRef;
  }

  previousValueRef = contextValueRef;
  contextValueRef = value;
  return null;
};

describe('ThemeProviderWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextValueRef = null;
    previousValueRef = null;
    renderCount = 0;
    valueChangedOnRerender = false;

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('should provide theme context with mode, setMode, and isDark', async () => {
    render(
      <ThemeProviderWrapper>
        <ContextValueTracker />
      </ThemeProviderWrapper>
    );

    await waitFor(() => {
      expect(contextValueRef).toBeDefined();
    });

    expect(contextValueRef).toHaveProperty('mode');
    expect(contextValueRef).toHaveProperty('setMode');
    expect(contextValueRef).toHaveProperty('isDark');
    expect(contextValueRef!.mode).toBe('light');
    expect(typeof contextValueRef!.setMode).toBe('function');
    expect(contextValueRef!.isDark).toBe(false);
  });

  it('should memoize context value — reference should not change on parent re-render when mode/isDark unchanged', async () => {
    const { rerender } = render(
      <ThemeProviderWrapper>
        <ContextValueTracker />
      </ThemeProviderWrapper>
    );

    await waitFor(() => {
      expect(contextValueRef).toBeDefined();
    });

    const firstRef = contextValueRef;

    // Force re-render of parent — context value reference should be stable
    await act(async () => {
      rerender(
        <ThemeProviderWrapper>
          <ContextValueTracker />
        </ThemeProviderWrapper>
      );
    });

    // With useMemo, the context value reference stays the same when mode/isDark haven't changed
    // Without useMemo, a new object is created every render
    expect(contextValueRef).toBe(firstRef);
  });
});
