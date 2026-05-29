import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorGroupSection } from '../EditorGroupSection';
import type { MealItem } from '@/types/meal-plan';

afterEach(cleanup);

function group(title: string, ings: any[] = []): MealItem {
  return {
    type: 'ingredientGroup',
    id: '',
    name: title,
    ingredients: [{ title, ingredients: ings }],
  };
}

const noop = {
  onTitleChange: vi.fn(),
  onRemoveGroup: vi.fn(),
  onQtyClick: vi.fn(),
  onUnitClick: vi.fn(),
  onRemoveIngredient: vi.fn(),
  invalidIngredientIndexes: [] as number[],
};

describe('EditorGroupSection', () => {
  it('renders the GROUP label and title value', () => {
    render(
      <EditorGroupSection
        group={group('Side salad', [
          { type: 'foodItem', id: 'a', name: 'romaine', quantity: 1, unit: 'head' },
        ])}
        {...noop}
      />
    );
    expect(screen.getByText('GROUP')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Side salad')).toBeInTheDocument();
    expect(screen.getByText('romaine')).toBeInTheDocument();
  });

  it('shows the required helper and warn when title is empty', () => {
    render(<EditorGroupSection group={group('', [])} titleInvalid {...noop} />);
    expect(screen.getByText(/group title is required/i)).toBeInTheDocument();
  });

  it('shows empty state when the group has no ingredients', () => {
    render(<EditorGroupSection group={group('Sides', [])} {...noop} />);
    expect(screen.getByText(/no items in this group/i)).toBeInTheDocument();
  });

  it('remove-group button fires onRemoveGroup', async () => {
    const user = userEvent.setup();
    const onRemoveGroup = vi.fn();
    render(
      <EditorGroupSection group={group('Sides', [])} {...noop} onRemoveGroup={onRemoveGroup} />
    );
    await user.click(screen.getByRole('button', { name: /remove group/i }));
    expect(onRemoveGroup).toHaveBeenCalledTimes(1);
  });

  it('editing the title fires onTitleChange', async () => {
    const user = userEvent.setup();
    const onTitleChange = vi.fn();
    render(<EditorGroupSection group={group('S', [])} {...noop} onTitleChange={onTitleChange} />);
    await user.type(screen.getByDisplayValue('S'), 'x');
    expect(onTitleChange).toHaveBeenCalled();
  });
});
