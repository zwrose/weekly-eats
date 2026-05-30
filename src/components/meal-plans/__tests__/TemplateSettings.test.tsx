import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../vitest.setup';
import { TemplateSettings } from '../TemplateSettings';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}));

const template = {
  _id: 't',
  userId: 'u',
  startDay: 'monday',
  meals: { breakfast: true, lunch: true, dinner: true, staples: true },
  weeklyStaples: [
    {
      type: 'ingredientGroup',
      id: '',
      name: 'Breakfasts',
      ingredients: [
        {
          title: 'Breakfasts',
          ingredients: [
            { type: 'foodItem', id: 'a', name: 'fruit', quantity: 1, unit: 'package' },
            { type: 'foodItem', id: 'b', name: 'milk', quantity: 1, unit: 'gallon' },
          ],
        },
      ],
    },
    { type: 'foodItem', id: 'c', name: 'eggs', quantity: 12, unit: 'each' },
  ],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

afterEach(() => {
  cleanup();
  push.mockClear();
});

describe('TemplateSettings (template route)', () => {
  it('renders the start day, meal toggles, and staples summary from the fetched template', async () => {
    server.use(http.get('/api/meal-plans/template', () => HttpResponse.json(template)));
    render(<TemplateSettings />);

    // Title + day chips render once loaded.
    await waitFor(() => expect(screen.getByText('Your default plan shape')).toBeInTheDocument());
    // Monday chip is selected (aria-pressed).
    expect(screen.getByRole('button', { name: 'Mon' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Sun' })).toHaveAttribute('aria-pressed', 'false');
    // Meal toggles present.
    expect(screen.getByText('Breakfast')).toBeInTheDocument();
    // Staples summary: group row + an "Other" row for the loose item.
    expect(screen.getByText('Breakfasts')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
  });

  it('changing start day + a meal toggle, then Save, PUTs the updated template and returns to the index', async () => {
    const user = userEvent.setup();
    const captured: { startDay?: string; meals?: Record<string, boolean> }[] = [];
    server.use(
      http.get('/api/meal-plans/template', () => HttpResponse.json(template)),
      http.put('/api/meal-plans/template', async ({ request }) => {
        const body = (await request.json()) as {
          startDay?: string;
          meals?: Record<string, boolean>;
        };
        captured.push(body);
        return HttpResponse.json({ ...template, ...body });
      })
    );
    render(<TemplateSettings />);
    await waitFor(() => expect(screen.getByText('Your default plan shape')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Wed' }));
    await user.click(screen.getByRole('checkbox', { name: 'Lunch' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/meal-plans'));
    expect(captured[0]?.startDay).toBe('wednesday');
    expect(captured[0]?.meals?.lunch).toBe(false);
  });

  it('the back button navigates to the index when there are no unsaved changes', async () => {
    const user = userEvent.setup();
    server.use(http.get('/api/meal-plans/template', () => HttpResponse.json(template)));
    render(<TemplateSettings />);
    await waitFor(() => expect(screen.getByText('Your default plan shape')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Plans/ }));
    expect(push).toHaveBeenCalledWith('/meal-plans');
  });

  it('warns before discarding unsaved changes on leave; Keep editing stays, Discard leaves', async () => {
    const user = userEvent.setup();
    server.use(http.get('/api/meal-plans/template', () => HttpResponse.json(template)));
    render(<TemplateSettings />);
    await waitFor(() => expect(screen.getByText('Your default plan shape')).toBeInTheDocument());

    // Make an edit, then try to leave → discard prompt instead of navigating.
    await user.click(screen.getByRole('button', { name: 'Fri' }));
    await user.click(screen.getByRole('button', { name: /Plans/ }));
    expect(screen.getByText('Discard changes?')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    // Keep editing → stays put (wait for the modal to fully dismiss).
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();

    // Leave again, then Discard → navigates.
    await user.click(screen.getByRole('button', { name: /Plans/ }));
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(push).toHaveBeenCalledWith('/meal-plans');
  });

  it('falls back to the default template when none exists yet', async () => {
    server.use(http.get('/api/meal-plans/template', () => new HttpResponse(null, { status: 404 })));
    render(<TemplateSettings />);
    await waitFor(() => expect(screen.getByText('Your default plan shape')).toBeInTheDocument());
    // A day chip is selected (the default startDay), proving the fallback rendered.
    const selected = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(selected.length).toBe(1);
  });
});
