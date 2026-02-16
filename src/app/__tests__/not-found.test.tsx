import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import NotFound from '../not-found';

describe('NotFound', () => {
  it('displays a 404 message', () => {
    render(<NotFound />);
    expect(screen.getByText(/404/)).toBeInTheDocument();
  });

  it('provides a link to go home', () => {
    render(<NotFound />);
    const link = screen.getByRole('link', { name: /go home|back to home/i });
    expect(link).toHaveAttribute('href', '/');
  });
});
