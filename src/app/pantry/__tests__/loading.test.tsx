import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import PantryLoading from '../loading';

// Mock AuthenticatedLayout to isolate the skeleton content
vi.mock('@/components/AuthenticatedLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('PantryLoading', () => {
  it('renders without crashing', () => {
    const { container } = render(<PantryLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders skeleton elements for page structure', () => {
    const { container } = render(<PantryLoading />);
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
