import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShoppingListsError from '../error';

afterEach(cleanup);

describe('ShoppingListsError', () => {
  it('displays the error message', () => {
    render(<ShoppingListsError error={new Error('Something went wrong')} reset={vi.fn()} />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('calls reset when Try Again is clicked', async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    render(<ShoppingListsError error={new Error('fail')} reset={reset} />);
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
