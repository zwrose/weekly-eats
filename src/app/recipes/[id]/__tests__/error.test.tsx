import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecipeDetailError from '../error';

afterEach(cleanup);

describe('RecipeDetailError', () => {
  it('displays the error message', () => {
    render(<RecipeDetailError error={new Error('Boom')} reset={vi.fn()} />);
    expect(screen.getByText(/boom/i)).toBeInTheDocument();
  });
  it('calls reset when Try Again is clicked', async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    render(<RecipeDetailError error={new Error('x')} reset={reset} />);
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
