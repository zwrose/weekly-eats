import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanViewDesktop } from '../PlanViewDesktop';
import type { PlanViewProps } from '../meal-display-utils';
import type { MealPlanItem } from '@/types/meal-plan';

afterEach(cleanup);

function mk(p: Partial<MealPlanItem>): MealPlanItem {
  return {
    _id: 'x',
    mealPlanId: 'p',
    dayOfWeek: 'wednesday',
    mealType: 'dinner',
    items: [],
    ...p,
  } as MealPlanItem;
}

const base: PlanViewProps = {
  daysInOrder: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  enabledMeals: ['breakfast', 'lunch', 'dinner'],
  dateLabelForDay: (d) => d.slice(0, 3),
  todayDow: 'wednesday',
  onEditMeal: vi.fn(),
  mealsByDay: {
    wednesday: {
      breakfast: mk({
        dayOfWeek: 'wednesday',
        mealType: 'breakfast',
        items: [{ type: 'foodItem', id: 'f', name: 'eggs', quantity: 2, unit: 'each' }],
      }),
      dinner: mk({
        dayOfWeek: 'wednesday',
        mealType: 'dinner',
        items: [{ type: 'recipe', id: 'r', name: 'Thai coconut curry', quantity: 2 }],
      }),
    },
    monday: {
      dinner: mk({
        dayOfWeek: 'monday',
        mealType: 'dinner',
        items: [{ type: 'recipe', id: 'r2', name: 'Lemon ricotta pasta', quantity: 1 }],
      }),
    },
  },
};

describe('PlanViewDesktop', () => {
  it('renders the today hero with TODAY and the meal-label columns', () => {
    render(<PlanViewDesktop {...base} />);
    expect(screen.getAllByText('TODAY')).toHaveLength(2); // hero badge + vertical sliver
    expect(screen.getByText('Breakfast')).toBeInTheDocument();
    expect(screen.getByText('Dinner')).toBeInTheDocument();
    expect(screen.getByText('Thai coconut curry')).toBeInTheDocument();
  });

  it('renders a vertical TODAY sliver pill in the strip', () => {
    render(<PlanViewDesktop {...base} />);
    // Two "TODAY" texts: the hero badge + the vertical sliver
    expect(screen.getAllByText('TODAY').length).toBeGreaterThanOrEqual(2);
  });

  it('clicking a hero meal column calls onEditMeal', async () => {
    const user = userEvent.setup();
    const onEditMeal = vi.fn();
    render(<PlanViewDesktop {...base} onEditMeal={onEditMeal} />);
    await user.click(screen.getByText('Thai coconut curry'));
    expect(onEditMeal).toHaveBeenCalledWith('wednesday', 'dinner');
  });

  it('non-current plan: no hero, all days in strip, no sliver', () => {
    render(<PlanViewDesktop {...base} todayDow={null} />);
    expect(screen.queryByText('TODAY')).not.toBeInTheDocument();
    expect(screen.getByText('Lemon ricotta pasta')).toBeInTheDocument();
  });

  it('empty meals in the strip are tappable (+ Add) and call onEditMeal', async () => {
    const user = userEvent.setup();
    const onEditMeal = vi.fn();
    render(<PlanViewDesktop {...base} onEditMeal={onEditMeal} />);
    // Tuesday has no meals at all → each enabled meal renders a tappable "+ Add".
    await user.click(screen.getByRole('button', { name: 'Add breakfast for tue' }));
    expect(onEditMeal).toHaveBeenCalledWith('tuesday', 'breakfast');
  });

  it('non-current plan: empty strip meals are still tappable (+ Add)', async () => {
    const user = userEvent.setup();
    const onEditMeal = vi.fn();
    render(<PlanViewDesktop {...base} todayDow={null} onEditMeal={onEditMeal} />);
    // monday has only dinner → its empty breakfast is a tappable "+ Add".
    await user.click(screen.getByRole('button', { name: 'Add breakfast for mon' }));
    expect(onEditMeal).toHaveBeenCalledWith('monday', 'breakfast');
  });
});
