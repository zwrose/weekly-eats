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

  it('offers "New group with X" and calls onAddGroup with the query', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/recipes', () => HttpResponse.json([])),
      http.get('/api/food-items', () => HttpResponse.json([]))
    );
    const onAddGroup = vi.fn();
    render(<CombinedSearch {...props({ onAddGroup })} />);
    await user.type(screen.getByPlaceholderText(/add item, recipe, or new group/i), 'Sides');
    await waitFor(() => expect(screen.getByText(/new group with "Sides"/i)).toBeInTheDocument(), {
      timeout: 2000,
    });
    await user.click(screen.getByText(/new group with "Sides"/i));
    expect(onAddGroup).toHaveBeenCalledWith('Sides');
  });
});
