// src/components/recipes/__tests__/RecipeDetail.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeDetail } from '../RecipeDetail';

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
    expect(screen.getByText('italian')).toBeInTheDocument();
  });

  it('back link navigates to the list', async () => {
    const user = userEvent.setup();
    render(<RecipeDetail recipeId="r1" />);
    await waitFor(() => screen.getByText('Lemon pasta'));
    await user.click(screen.getByRole('button', { name: /recipes/i }));
    expect(push).toHaveBeenCalledWith('/recipes');
  });

  it('Edit enters the editor; the creator sees Edit', async () => {
    const user = userEvent.setup();
    render(<RecipeDetail recipeId="r1" />);
    await waitFor(() => screen.getByText('Lemon pasta'));
    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByTestId('recipe-editor')).toBeInTheDocument();
  });
});
