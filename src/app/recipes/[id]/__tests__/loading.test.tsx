import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import RecipeDetailLoading from '../loading';

vi.mock('@/components/AuthenticatedLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('RecipeDetailLoading', () => {
  it('renders skeleton elements', () => {
    const { container } = render(<RecipeDetailLoading />);
    expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
  });
});
