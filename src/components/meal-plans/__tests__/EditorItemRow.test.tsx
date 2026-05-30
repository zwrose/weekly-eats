import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorItemRow } from '../EditorItemRow';
import { RecipeEmojiProvider } from '../recipe-emoji';
import type { MealItem } from '@/types/meal-plan';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

afterEach(cleanup);

describe('EditorItemRow', () => {
  it('shows the recipe emoji (looked up by id from context) before the name', () => {
    render(
      <RecipeEmojiProvider value={{ r1: '🍝' }}>
        <EditorItemRow
          item={{ type: 'recipe', id: 'r1', name: 'Pasta', quantity: 1 }}
          onQtyClick={vi.fn()}
          onUnitClick={vi.fn()}
          onRemove={vi.fn()}
        />
      </RecipeEmojiProvider>
    );
    expect(screen.getByText('🍝')).toBeInTheDocument();
    expect(screen.getByText('Pasta')).toBeInTheDocument();
  });

  it('food row shows qty + unit chips and remove', async () => {
    const user = userEvent.setup();
    const onQty = vi.fn();
    const onUnit = vi.fn();
    const onRemove = vi.fn();
    const item: MealItem = {
      type: 'foodItem',
      id: 'f1',
      name: 'romaine',
      quantity: 1,
      unit: 'head',
    };
    render(
      <EditorItemRow item={item} onQtyClick={onQty} onUnitClick={onUnit} onRemove={onRemove} />
    );
    expect(screen.getByText('romaine')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /quantity/i }));
    expect(onQty).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /unit/i }));
    expect(onUnit).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /remove/i }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('recipe row shows × multiplier and a Recipe tag, no unit chip', () => {
    const item: MealItem = { type: 'recipe', id: 'r1', name: 'Coconut curry', quantity: 2 };
    render(
      <EditorItemRow item={item} onQtyClick={vi.fn()} onUnitClick={vi.fn()} onRemove={vi.fn()} />
    );
    expect(screen.getByText('Coconut curry')).toBeInTheDocument();
    expect(screen.getByText('Recipe')).toBeInTheDocument();
    expect(screen.getByText(/×\s*2/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /unit/i })).not.toBeInTheDocument();
  });

  it('invalid food row shows the warn placeholder', () => {
    const item: MealItem = { type: 'foodItem', id: '', name: '', quantity: 1, unit: 'cup' };
    render(
      <EditorItemRow
        item={item}
        invalid
        onQtyClick={vi.fn()}
        onUnitClick={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText(/pick a food or recipe/i)).toBeInTheDocument();
  });
});

describe('EditorItemRow recipe navigation', () => {
  afterEach(() => {
    cleanup();
    push.mockClear();
  });

  it('tapping a recipe row navigates to the recipe via router.push (no target=_blank)', async () => {
    const user = userEvent.setup();
    render(
      <RecipeEmojiProvider value={{}}>
        <EditorItemRow
          item={{ type: 'recipe', id: 'r1', name: 'Pesto', quantity: 1 }}
          onQtyClick={vi.fn()}
          onUnitClick={vi.fn()}
          onRemove={vi.fn()}
        />
      </RecipeEmojiProvider>
    );
    await user.click(screen.getByText('Pesto'));
    expect(push).toHaveBeenCalledWith('/recipes/r1');
  });

  it('the remove control does not trigger navigation', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <RecipeEmojiProvider value={{}}>
        <EditorItemRow
          item={{ type: 'recipe', id: 'r1', name: 'Pesto', quantity: 1 }}
          onQtyClick={vi.fn()}
          onUnitClick={vi.fn()}
          onRemove={onRemove}
        />
      </RecipeEmojiProvider>
    );
    await user.click(screen.getByRole('button', { name: /remove/i }));
    expect(onRemove).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
