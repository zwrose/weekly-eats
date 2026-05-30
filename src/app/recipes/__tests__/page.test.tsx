import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../vitest.setup';
import RecipesPage from '../page';

const push = vi.fn();
const replace = vi.fn();
let searchParams = new URLSearchParams();
vi.mock('next/navigation', async (orig) => ({
  ...(await orig<typeof import('next/navigation')>()),
  useRouter: () => ({ push, replace, back: vi.fn() }),
  useSearchParams: () => searchParams,
  usePathname: () => '/recipes',
}));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'me' } }, status: 'authenticated' }),
}));
vi.mock('@/components/recipes/RecipeEditor', () => ({
  RecipeEditor: () => <div data-testid="recipe-editor" />,
}));

const recipesPayload = {
  data: [
    {
      _id: 'r1',
      title: 'Lemon pasta',
      emoji: '🍝',
      isGlobal: false,
      createdBy: 'me',
      updatedAt: '2026-05-04T00:00:00Z',
      accessLevel: 'private',
      ingredients: [],
      instructions: '',
    },
  ],
  total: 1,
  page: 1,
  limit: 20,
  totalPages: 1,
};

afterEach(() => {
  cleanup();
  push.mockClear();
  replace.mockClear();
  searchParams = new URLSearchParams();
});

describe('RecipesPage (list)', () => {
  it('renders recipes and navigates to the detail route on row click', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/recipes', () => HttpResponse.json(recipesPayload)),
      http.post('/api/recipes/user-data/batch', () => HttpResponse.json({ data: {} })),
      http.get('/api/recipes/tags', () => HttpResponse.json([])),
      http.get('/api/user/recipe-sharing/invitations', () => HttpResponse.json([])),
      http.get('/api/user/recipe-sharing/shared-users', () => HttpResponse.json([]))
    );
    render(<RecipesPage />);
    // Both desktop table and mobile card render; use getAllByText and click the first.
    await waitFor(() => expect(screen.getAllByText('Lemon pasta').length).toBeGreaterThan(0));
    await user.click(screen.getAllByText('Lemon pasta')[0]);
    expect(push).toHaveBeenCalledWith('/recipes/r1');
  });

  it('+ New recipe opens the editor takeover', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/recipes', () => HttpResponse.json(recipesPayload)),
      http.post('/api/recipes/user-data/batch', () => HttpResponse.json({ data: {} })),
      http.get('/api/recipes/tags', () => HttpResponse.json([])),
      http.get('/api/user/recipe-sharing/invitations', () => HttpResponse.json([])),
      http.get('/api/user/recipe-sharing/shared-users', () => HttpResponse.json([]))
    );
    render(<RecipesPage />);
    await waitFor(() => screen.getAllByText('Lemon pasta'));
    await user.click(screen.getByRole('button', { name: /new recipe/i }));
    expect(screen.getByTestId('recipe-editor')).toBeInTheDocument();
  });

  it('redirects the legacy ?viewRecipe deep-link to the new route', async () => {
    searchParams = new URLSearchParams('viewRecipe=true&viewRecipe_recipeId=r9');
    server.use(
      http.get('/api/recipes', () => HttpResponse.json({ ...recipesPayload, data: [] })),
      http.post('/api/recipes/user-data/batch', () => HttpResponse.json({ data: {} })),
      http.get('/api/recipes/tags', () => HttpResponse.json([])),
      http.get('/api/user/recipe-sharing/invitations', () => HttpResponse.json([])),
      http.get('/api/user/recipe-sharing/shared-users', () => HttpResponse.json([]))
    );
    render(<RecipesPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/recipes/r9'));
  });

  it('strips a bare ?viewRecipe (no id) to /recipes', async () => {
    searchParams = new URLSearchParams('viewRecipe=true');
    server.use(
      http.get('/api/recipes', () => HttpResponse.json({ ...recipesPayload, data: [] })),
      http.post('/api/recipes/user-data/batch', () => HttpResponse.json({ data: {} })),
      http.get('/api/recipes/tags', () => HttpResponse.json([])),
      http.get('/api/user/recipe-sharing/invitations', () => HttpResponse.json([])),
      http.get('/api/user/recipe-sharing/shared-users', () => HttpResponse.json([]))
    );
    render(<RecipesPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/recipes'));
  });
});
