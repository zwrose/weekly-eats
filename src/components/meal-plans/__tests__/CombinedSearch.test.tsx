import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../vitest.setup';
import { CombinedSearch } from '../CombinedSearch';

// MSW is globally active (vitest.setup.ts). Do NOT stub global.fetch — override
// handlers per-test via server.use(); afterEach in the global setup resets them.
afterEach(cleanup);

function props(over = {}) {
  return {
    excludeIds: [],
    onAddFood: vi.fn(),
    onAddRecipe: vi.fn(),
    onAddGroup: vi.fn(),
    onFoodItemAdded: vi.fn(),
    ...over,
  };
}

describe('CombinedSearch', () => {
  it('typing a query searches and lists a matching recipe; selecting it calls onAddRecipe', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/recipes', () =>
        HttpResponse.json([{ _id: 'r1', title: 'Parmesan pasta', emoji: '🍝' }])
      ),
      http.get('/api/food-items', () => HttpResponse.json([]))
    );
    const onAddRecipe = vi.fn();
    render(<CombinedSearch {...props({ onAddRecipe })} />);
    await user.type(screen.getByPlaceholderText(/add item, recipe, or new group/i), 'parm');
    await waitFor(() => expect(screen.getByText('Parmesan pasta')).toBeInTheDocument(), {
      timeout: 2000,
    });
    await user.click(screen.getByText('Parmesan pasta'));
    expect(onAddRecipe).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'r1', title: 'Parmesan pasta' })
    );
  });

  it('shows a recipe emoji inline before its title in the results', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/recipes', () =>
        HttpResponse.json([{ _id: 'r1', title: 'Parmesan pasta', emoji: '🍝' }])
      ),
      http.get('/api/food-items', () => HttpResponse.json([]))
    );
    render(<CombinedSearch {...props()} />);
    await user.type(screen.getByPlaceholderText(/add item, recipe, or new group/i), 'parm');
    await waitFor(() => expect(screen.getByText('Parmesan pasta')).toBeInTheDocument(), {
      timeout: 2000,
    });
    expect(screen.getByText('🍝')).toBeInTheDocument();
  });

  it('offers "New group with X" and calls onAddGroup with the query', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/recipes', () => HttpResponse.json([])),
      http.get('/api/food-items', () => HttpResponse.json([]))
    );
    const onAddGroup = vi.fn();
    render(<CombinedSearch {...props({ onAddGroup })} />);
    await user.type(screen.getByPlaceholderText(/add item, recipe, or new group/i), 'Sides');
    await waitFor(() => expect(screen.getByText(/create new group "Sides"/i)).toBeInTheDocument(), {
      timeout: 2000,
    });
    await user.click(screen.getByText(/create new group "Sides"/i));
    expect(onAddGroup).toHaveBeenCalledWith('Sides');
  });

  it('ArrowUp browses up into the results and Enter selects the highlighted row', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/recipes', () => HttpResponse.json([{ _id: 'r1', title: 'Parmesan pasta' }])),
      http.get('/api/food-items', () => HttpResponse.json([]))
    );
    const onAddRecipe = vi.fn();
    render(<CombinedSearch {...props({ onAddRecipe })} />);
    await user.type(screen.getByPlaceholderText(/add item, recipe, or new group/i), 'parm');
    await waitFor(() => expect(screen.getByText('Parmesan pasta')).toBeInTheDocument(), {
      timeout: 2000,
    });
    // rows top→bottom: [recipe, create-food, new-group]. ArrowUp from the input enters
    // at the bottom row and walks up; 3 presses reach the recipe.
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}{Enter}');
    expect(onAddRecipe).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'r1', title: 'Parmesan pasta' })
    );
  });

  it('ArrowUp once highlights the bottom (New group) action; Enter triggers it', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/recipes', () => HttpResponse.json([{ _id: 'r1', title: 'Parmesan pasta' }])),
      http.get('/api/food-items', () => HttpResponse.json([]))
    );
    const onAddGroup = vi.fn();
    render(<CombinedSearch {...props({ onAddGroup })} />);
    await user.type(screen.getByPlaceholderText(/add item, recipe, or new group/i), 'Sides');
    await waitFor(() => expect(screen.getByText(/create new group "Sides"/i)).toBeInTheDocument(), {
      timeout: 2000,
    });
    await user.keyboard('{ArrowUp}{Enter}'); // bottom row is the New group action
    expect(onAddGroup).toHaveBeenCalledWith('Sides');
  });

  it('with no matching results, Enter starts the new-food-item flow (no arrowing)', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/recipes', () => HttpResponse.json([])),
      http.get('/api/food-items', () => HttpResponse.json([]))
    );
    render(<CombinedSearch {...props()} />);
    await user.type(screen.getByPlaceholderText(/add item, recipe, or new group/i), 'Zucchini');
    await waitFor(() => expect(screen.getByText(/no matches found/i)).toBeInTheDocument(), {
      timeout: 2000,
    });
    await user.keyboard('{Enter}');
    // The AddFoodItemDialog (a MUI Dialog) opens, prefilled with the query.
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument(), { timeout: 2000 });
  });
});
