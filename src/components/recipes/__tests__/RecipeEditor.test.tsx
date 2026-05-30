// src/components/recipes/__tests__/RecipeEditor.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeEditor } from '../RecipeEditor';
import type { Recipe } from '@/types/recipe';

vi.mock('@/lib/recipe-utils', () => ({
  createRecipe: vi.fn(async (r) => ({ ...r, _id: 'new1' })),
  updateRecipe: vi.fn(async (id, r) => ({ ...r, _id: id })),
  deleteRecipe: vi.fn(async () => ({ success: true })),
}));
vi.mock('@/lib/recipe-user-data-utils', () => ({
  updateRecipeTags: vi.fn(async () => ({})),
  updateRecipeRating: vi.fn(async () => ({})),
  deleteRecipeRating: vi.fn(async () => ({})),
}));
// Keep the ingredients editor light — exercised in its own test (Task 9).
// forwardRef so RecipeEditor's ref={ingredientsRef} attaches without a warning.
vi.mock('../RecipeIngredientsEditor', async () => {
  const React = await import('react');
  return {
    validateRecipeIngredients: (lists: { ingredients: unknown[] }[]) =>
      lists.some((l) => l.ingredients.length > 0),
    RecipeIngredientsEditor: React.forwardRef(function MockIngredientsEditor() {
      return <div data-testid="ingredients-editor" />;
    }),
  };
});

import { createRecipe, updateRecipe, deleteRecipe } from '@/lib/recipe-utils';

const existing: Recipe = {
  _id: 'r1',
  title: 'Lemon pasta',
  emoji: '🍝',
  isGlobal: false,
  ingredients: [
    {
      title: 'Pasta',
      ingredients: [{ type: 'foodItem', id: 'a', quantity: 1, unit: 'lb', name: 'spaghetti' }],
    },
  ],
  instructions: 'Boil.',
  createdBy: 'me',
  createdAt: new Date().toISOString() as unknown as Date,
  updatedAt: new Date().toISOString() as unknown as Date,
};

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe('RecipeEditor', () => {
  it('edit mode seeds the title and saves via updateRecipe', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <RecipeEditor
        mode="edit"
        recipe={existing}
        userData={{ tags: [], rating: undefined }}
        onSaved={onSaved}
        onClose={vi.fn()}
        onDeleted={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue('Lemon pasta')).toBeInTheDocument();
    // Mobile + desktop each render a Save control; clicking either saves.
    await user.click(screen.getAllByRole('button', { name: /^save$/i })[0]);
    await waitFor(() =>
      expect(updateRecipe).toHaveBeenCalledWith(
        'r1',
        expect.objectContaining({ title: 'Lemon pasta' })
      )
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('create mode disables Save until a title + an ingredient exist', async () => {
    render(<RecipeEditor mode="create" onSaved={vi.fn()} onClose={vi.fn()} />);
    // No title, no ingredients (mock validate returns false) → disabled
    screen.getAllByRole('button', { name: /^save$/i }).forEach((btn) => expect(btn).toBeDisabled());
  });

  it('Cancel with edits prompts a discard confirmation', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <RecipeEditor
        mode="edit"
        recipe={existing}
        userData={{ tags: [], rating: undefined }}
        onSaved={vi.fn()}
        onClose={onClose}
        onDeleted={vi.fn()}
      />
    );
    await user.clear(screen.getByDisplayValue('Lemon pasta'));
    await user.type(screen.getByLabelText(/title/i), 'Changed');
    await user.click(screen.getAllByRole('button', { name: /^cancel$/i })[0]);
    expect(screen.getByText(/discard changes/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Delete confirms then calls deleteRecipe + onDeleted', async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    render(
      <RecipeEditor
        mode="edit"
        recipe={existing}
        userData={{ tags: [], rating: undefined }}
        onSaved={vi.fn()}
        onClose={vi.fn()}
        onDeleted={onDeleted}
      />
    );
    await user.click(screen.getByRole('button', { name: /delete recipe/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i })); // confirm
    await waitFor(() => expect(deleteRecipe).toHaveBeenCalledWith('r1'));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });
});
