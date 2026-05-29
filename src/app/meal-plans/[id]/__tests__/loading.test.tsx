import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import MealPlanDetailLoading from '../loading';

// Mock AuthenticatedLayout to isolate the skeleton content
vi.mock('@/components/AuthenticatedLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

afterEach(cleanup);

describe('MealPlanDetailLoading', () => {
  it('renders without crashing', () => {
    const { container } = render(<MealPlanDetailLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders skeleton elements for page structure', () => {
    render(<MealPlanDetailLoading />);
    // MUI v7 Skeleton does not expose role="progressbar"; use a data-testid on at least
    // one skeleton as a stable structural anchor (the back-button skeleton).
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });
});
