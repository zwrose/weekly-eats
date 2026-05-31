import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StaplesBar } from '../StaplesBar';
import type { MealItem } from '@/types/meal-plan';

afterEach(cleanup);

const staples: MealItem[] = [
  {
    type: 'ingredientGroup',
    id: '',
    name: 'Breakfasts',
    ingredients: [
      {
        title: 'Breakfasts',
        ingredients: [
          { type: 'foodItem', id: 'a', quantity: 1, unit: 'package' },
          { type: 'foodItem', id: 'b', quantity: 1, unit: 'bag' },
        ],
      },
    ],
  },
  { type: 'foodItem', id: 'c', name: 'eggs', quantity: 12, unit: 'each' },
];

describe('StaplesBar', () => {
  it('shows the STAPLES label and total count, collapsed by default', () => {
    render(<StaplesBar staples={staples} onEdit={vi.fn()} />);
    expect(screen.getByText('Staples')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // 2 group + 1 loose
    // collapsed: the group's child item is not shown yet
    expect(screen.queryByText('eggs')).not.toBeInTheDocument();
  });

  it('expands to list groups and items when the summary row is clicked', async () => {
    const user = userEvent.setup();
    render(<StaplesBar staples={staples} onEdit={vi.fn()} />);
    await user.click(screen.getByText('Staples'));
    expect(screen.getByText('Breakfasts')).toBeInTheDocument();
    expect(screen.getByText('eggs')).toBeInTheDocument();
  });

  it('the edit button fires onEdit and does not expand', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<StaplesBar staples={staples} onEdit={onEdit} />);
    await user.click(screen.getByRole('button', { name: /edit staples/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('eggs')).not.toBeInTheDocument();
  });
});
