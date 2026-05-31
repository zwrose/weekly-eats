import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';

const { usePathnameMock } = vi.hoisted(() => ({ usePathnameMock: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: usePathnameMock }));

import { useActiveSection } from '../use-active-section';

beforeEach(() => usePathnameMock.mockReset());
afterEach(cleanup);

describe('useActiveSection', () => {
  it('derives the section from the current pathname', () => {
    usePathnameMock.mockReturnValue('/recipes/123');
    const { result } = renderHook(() => useActiveSection());
    expect(result.current).toBe('recipes');
  });

  it('returns null on a system page', () => {
    usePathnameMock.mockReturnValue('/food-items');
    const { result } = renderHook(() => useActiveSection());
    expect(result.current).toBeNull();
  });
});
