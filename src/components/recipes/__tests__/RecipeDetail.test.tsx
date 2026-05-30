// src/components/recipes/__tests__/RecipeDetail.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeDetail } from '../RecipeDetail';
import { deleteRecipe } from '@/lib/recipe-utils';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'me' } }, status: 'authenticated' }),
}));
vi.mock('@/lib/recipe-utils', () => ({
  fetchRecipe: vi.fn(async () => ({
    _id: 'r1',
    title: 'Lemon pasta',
    emoji: '🍝',
    isGlobal: false,
    createdBy: 'me',
    ingredients: [
      {
        title: 'Pasta',
        ingredients: [{ type: 'foodItem', id: 'a', quantity: 1, unit: 'lb', name: 'spaghetti' }],
      },
    ],
    instructions: 'Boil the pasta.',
    createdAt: '',
    updatedAt: '',
  })),
  deleteRecipe: vi.fn(async () => ({ success: true })),
}));
vi.mock('@/lib/recipe-user-data-utils', () => ({
  fetchRecipeUserData: vi.fn(async () => ({ tags: ['italian'], rating: 5 })),
  fetchUserTags: vi.fn(async () => ['italian', 'quick']),
}));
// Render the editor as a stub so this test stays about the detail shell.
vi.mock('../RecipeEditor', () => ({ RecipeEditor: () => <div data-testid="recipe-editor" /> }));

afterEach(cleanup);
beforeEach(() => push.mockClear());

describe('RecipeDetail', () => {
  it('renders the recipe after load', async () => {
    render(<RecipeDetail recipeId="r1" />);
    await waitFor(() => expect(screen.getByText('Lemon pasta')).toBeInTheDocument());
    expect(screen.getByText('spaghetti')).toBeInTheDocument();
    expect(screen.getByText('Boil the pasta.')).toBeInTheDocument();
    // Tags render in both the mobile row and the desktop-inline row (responsive variants).
    expect(screen.getAllByText('italian').length).toBeGreaterThan(0);
  });

  it('back link navigates to the list', async () => {
    const user = userEvent.setup();
    render(<RecipeDetail recipeId="r1" />);
    await waitFor(() => screen.getByText('Lemon pasta'));
    // Mobile and desktop each render a back control; clicking either navigates.
    await user.click(screen.getAllByRole('button', { name: /back to recipes/i })[0]);
    expect(push).toHaveBeenCalledWith('/recipes');
  });

  it('Edit enters the editor; the creator sees Edit', async () => {
    const user = userEvent.setup();
    render(<RecipeDetail recipeId="r1" />);
    await waitFor(() => screen.getByText('Lemon pasta'));
    await user.click(screen.getAllByRole('button', { name: /edit recipe/i })[0]);
    expect(screen.getByTestId('recipe-editor')).toBeInTheDocument();
  });

  it('delete flow: ⋯ menu → Delete → confirm calls deleteRecipe and navigates to /recipes', async () => {
    const user = userEvent.setup();
    render(<RecipeDetail recipeId="r1" />);
    await waitFor(() => screen.getByText('Lemon pasta'));

    // Open the ⋯ more menu (mobile + desktop each render one; either opens the shared menu)
    await user.click(screen.getAllByRole('button', { name: /more options/i })[0]);
    // Click Delete in the menu
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));
    // ConfirmDialog should appear — click the confirm button
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => expect(deleteRecipe).toHaveBeenCalledWith('r1'));
    expect(push).toHaveBeenCalledWith('/recipes');
  });
});
