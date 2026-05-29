import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../vitest.setup';
import { MealEditorDialog, type EditableMeal } from '../MealEditorDialog';
import type { MealItem } from '@/types/meal-plan';
import type { RecipeIngredient } from '@/types/recipe';

// MSW is globally active (vitest.setup.ts) — the inner CombinedSearch auto-loads
// /api/food-items + /api/recipes on mount; the global handlers serve those, and
// per-test server.use(...) overrides them. Do NOT stub global.fetch.
afterEach(cleanup);

function base(meal: Partial<EditableMeal> = {}) {
  return {
    open: true,
    title: 'Monday dinner',
    subtitle: 'May 11',
    meal: { items: [], skipped: false, skipReason: '', ...meal } as EditableMeal,
    onSave: vi.fn(),
    onClose: vi.fn(),
    onFoodItemAdded: vi.fn(),
  };
}
const recipe: MealItem = { type: 'recipe', id: 'r1', name: 'Lemon ricotta pasta', quantity: 1 };
const group = (title: string, ings: RecipeIngredient[] = []): MealItem => ({
  type: 'ingredientGroup',
  id: '',
  name: title,
  ingredients: [{ title, ingredients: ings }],
});

describe('MealEditorDialog', () => {
  it('decision 1: Done disabled when a group has no title; enabled when valid', () => {
    render(<MealEditorDialog {...base({ items: [group('')] })} />);
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
    cleanup();
    render(<MealEditorDialog {...base({ items: [recipe] })} />);
    expect(screen.getByRole('button', { name: 'Done' })).not.toBeDisabled();
  });

  it('decision 1: empty meal is valid (Done enabled) and shows the empty state', () => {
    render(<MealEditorDialog {...base()} />);
    expect(screen.getByText(/no items planned yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).not.toBeDisabled();
  });

  it('decision 3: no per-meal notes field is rendered', () => {
    render(<MealEditorDialog {...base({ items: [recipe] })} />);
    expect(screen.queryByLabelText(/notes/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/notes?/i)).not.toBeInTheDocument();
  });

  it('decision 2: clean cancel closes immediately; dirty cancel confirms', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<MealEditorDialog {...base({ items: [recipe] })} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1); // clean → immediate
    cleanup();

    const onClose2 = vi.fn();
    render(<MealEditorDialog {...base({ items: [recipe] })} onClose={onClose2} />);
    // make it dirty: remove the recipe
    await user.click(screen.getByRole('button', { name: /remove item/i }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose2).not.toHaveBeenCalled(); // dirty → confirm first
    expect(screen.getByText(/discard changes\?/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onClose2).toHaveBeenCalledTimes(1);
  });

  it('decision 4: recipe shows × qty chip and no unit chip', () => {
    render(<MealEditorDialog {...base({ items: [{ ...recipe, quantity: 2 }] })} />);
    expect(screen.getByText(/×\s*2/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /unit/i })).not.toBeInTheDocument();
  });

  it('decision 5: toggling skip on with items confirms then clears', async () => {
    const user = userEvent.setup();
    render(<MealEditorDialog {...base({ items: [recipe] })} />);
    await user.click(screen.getByRole('checkbox', { name: /skip this meal/i }));
    expect(screen.getByText(/will clear 1 item/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip anyway' }));
    expect(screen.queryByText('Lemon ricotta pasta')).not.toBeInTheDocument();
  });

  it('decision 5: toggling skip off leaves the meal empty (no items restored)', async () => {
    const user = userEvent.setup();
    render(<MealEditorDialog {...base({ items: [], skipped: true, skipReason: 'out' })} />);
    await user.click(screen.getByRole('checkbox', { name: /skip this meal/i }));
    expect(screen.getByText(/no items planned yet/i)).toBeInTheDocument();
  });

  it('decision 7: remove-group asks to confirm and names the count', async () => {
    const user = userEvent.setup();
    render(
      <MealEditorDialog
        {...base({
          items: [
            group('Side salad', [
              { type: 'foodItem', id: 'a', name: 'romaine', quantity: 1, unit: 'head' },
            ]),
          ],
        })}
      />
    );
    await user.click(screen.getByRole('button', { name: /remove group/i }));
    expect(screen.getByText(/remove group\?/i)).toBeInTheDocument();
    // The confirm body names the group; scope to the confirm dialog so we don't
    // collide with the group-title input that also displays "Side salad".
    const confirm = screen.getByText(/remove group\?/i).closest('[role="dialog"]') as HTMLElement;
    expect(within(confirm).getByText(/Side salad/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.queryByDisplayValue('Side salad')).not.toBeInTheDocument();
  });

  it('decision 8: group renders flat (GROUP label, no nested Paper/box) with its items as siblings', () => {
    render(
      <MealEditorDialog
        {...base({
          items: [
            recipe,
            group('Sides', [
              { type: 'foodItem', id: 'a', name: 'romaine', quantity: 1, unit: 'head' },
            ]),
          ],
        })}
      />
    );
    expect(screen.getByText('GROUP')).toBeInTheDocument();
    expect(screen.getByText('romaine')).toBeInTheDocument();
  });

  it('Done emits the current items/skipped/skipReason', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<MealEditorDialog {...base({ items: [recipe] })} onSave={onSave} />);
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onSave).toHaveBeenCalledWith({ items: [recipe], skipped: false, skipReason: '' });
  });

  it('staples mode hides the skip bar', () => {
    render(<MealEditorDialog {...base()} isStaples title="Weekly staples" />);
    expect(screen.queryByRole('checkbox', { name: /skip this meal/i })).not.toBeInTheDocument();
  });

  it('skip reason text flows into the onSave payload', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <MealEditorDialog {...base({ items: [], skipped: true, skipReason: '' })} onSave={onSave} />
    );
    await user.type(screen.getByPlaceholderText(/reason/i), 'out for work lunch');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onSave).toHaveBeenCalledWith({
      items: [],
      skipped: true,
      skipReason: 'out for work lunch',
    });
  });

  it('search-target: selecting a group routes the next added item INTO that group (and the chip clears it)', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/recipes', () => HttpResponse.json([])),
      http.get('/api/food-items', () =>
        HttpResponse.json([
          {
            _id: 'f1',
            name: 'romaine',
            singularName: 'romaine',
            pluralName: 'romaine',
            unit: 'head',
          },
        ])
      )
    );
    render(<MealEditorDialog {...base({ items: [group('Sides', [])] })} />);
    // tap the group's "Add items to this group" affordance to target it
    await user.click(screen.getByText(/add items to this group/i));
    expect(screen.getByText(/adding to:\s*sides/i)).toBeInTheDocument();
    // add a food item via the sticky search → should land inside "Sides", not loose
    await user.type(screen.getByPlaceholderText(/add item, recipe, or new group/i), 'rom');
    await waitFor(() => expect(screen.getByText('romaine')).toBeInTheDocument(), { timeout: 2000 });
    await user.click(screen.getByText('romaine'));
    // romaine routed INTO the targeted group: the empty-group affordance is replaced
    // (a loose add would leave "Add items to this group" intact) and a removable row exists.
    await waitFor(() =>
      expect(screen.queryByText(/add items to this group/i)).not.toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: /remove item/i })).toBeInTheDocument();
    // clearing the chip resets the target back to loose
    await user.click(screen.getByRole('button', { name: /stop adding to group/i }));
    expect(screen.queryByText(/adding to:/i)).not.toBeInTheDocument();
  });
});
