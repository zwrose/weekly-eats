import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MealPlanDetailError from '../error';

afterEach(cleanup);

describe('MealPlanDetailError', () => {
  it('displays the error message', () => {
    render(<MealPlanDetailError error={new Error('Something went wrong')} reset={vi.fn()} />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('calls reset when Try Again is clicked', async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    render(<MealPlanDetailError error={new Error('fail')} reset={reset} />);
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
