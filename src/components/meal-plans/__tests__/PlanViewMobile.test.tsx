import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanViewMobile } from '../PlanViewMobile';
import type { PlanViewProps } from '../meal-display-utils';
import type { MealPlanItem } from '@/types/meal-plan';

afterEach(cleanup);

function mk(partial: Partial<MealPlanItem>): MealPlanItem {
  return {
    _id: 'x',
    mealPlanId: 'p',
    dayOfWeek: 'monday',
    mealType: 'dinner',
    items: [],
    ...partial,
  } as MealPlanItem;
}

const base: PlanViewProps = {
  daysInOrder: ['monday', 'tuesday'],
  enabledMeals: ['breakfast', 'lunch', 'dinner'],
  dateLabelForDay: (d) => (d === 'monday' ? 'Mon, May 11' : 'Tue, May 12'),
  todayDow: 'monday',
  onEditMeal: vi.fn(),
  mealsByDay: {
    monday: {
      dinner: mk({
        dayOfWeek: 'monday',
        mealType: 'dinner',
        items: [{ type: 'recipe', id: 'r1', name: 'Lemon ricotta pasta', quantity: 1 }],
      }),
    },
    tuesday: {
      breakfast: mk({
        dayOfWeek: 'tuesday',
        mealType: 'breakfast',
        skipped: true,
        skipReason: 'coffee only',
        items: [],
      }),
    },
  },
};

describe('PlanViewMobile', () => {
  it('renders a card per day with the date label', () => {
    render(<PlanViewMobile {...base} />);
    expect(screen.getByText('Mon, May 11')).toBeInTheDocument();
    expect(screen.getByText('Tue, May 12')).toBeInTheDocument();
  });

  it('marks today with a TODAY badge', () => {
    render(<PlanViewMobile {...base} />);
    expect(screen.getByText('TODAY')).toBeInTheDocument();
  });

  it('renders a filled meal and shows a skipped reason', () => {
    render(<PlanViewMobile {...base} />);
    expect(screen.getByText('Lemon ricotta pasta')).toBeInTheDocument();
    expect(screen.getByText(/coffee only/)).toBeInTheDocument();
  });

  it('tapping a filled meal calls onEditMeal with its day + type', async () => {
    const user = userEvent.setup();
    const onEditMeal = vi.fn();
    render(<PlanViewMobile {...base} onEditMeal={onEditMeal} />);
    await user.click(screen.getByText('Lemon ricotta pasta'));
    expect(onEditMeal).toHaveBeenCalledWith('monday', 'dinner');
  });

  it('shows + chips for enabled-but-empty meals and they call onEditMeal', async () => {
    const user = userEvent.setup();
    const onEditMeal = vi.fn();
    render(<PlanViewMobile {...base} onEditMeal={onEditMeal} />);
    // Monday breakfast + lunch are enabled but empty -> + chips
    await user.click(screen.getByRole('button', { name: /add breakfast/i }));
    expect(onEditMeal).toHaveBeenCalledWith('monday', 'breakfast');
  });
});
