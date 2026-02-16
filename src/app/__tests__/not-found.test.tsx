import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import NotFound from '../not-found';

afterEach(cleanup);

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
