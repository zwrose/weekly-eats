import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../vitest.setup';
import { PlanDetail } from '../PlanDetail';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}));

const plan = {
  _id: 'p1',
  userId: 'u',
  name: 'Week of May 11',
  startDate: '2026-05-11',
  endDate: '2026-05-17',
  templateId: 't',
  templateSnapshot: {
    startDay: 'monday',
    meals: { breakfast: true, lunch: true, dinner: true, staples: true },
  },
  template: {
    _id: 't',
    userId: 'u',
    startDay: 'monday',
    meals: { breakfast: true, lunch: true, dinner: true, staples: true },
    weeklyStaples: [],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  items: [
    {
      _id: 'm1',
      mealPlanId: 'p1',
      dayOfWeek: 'monday',
      mealType: 'dinner',
      items: [{ type: 'recipe', id: 'r1', name: 'Lemon ricotta pasta', quantity: 1 }],
    },
  ],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

afterEach(() => {
  cleanup();
  push.mockReset();
});

describe('PlanDetail (route surface)', () => {
  it('fetches and renders the plan title + a meal', async () => {
    server.use(http.get('/api/meal-plans/p1', () => HttpResponse.json(plan)));
    render(<PlanDetail planId="p1" />);
    await waitFor(() => expect(screen.getByText('Week of May 11')).toBeInTheDocument());
    expect(screen.getAllByText('Lemon ricotta pasta').length).toBeGreaterThan(0);
  });

  it('the back button navigates to the index', async () => {
    const user = userEvent.setup();
    server.use(http.get('/api/meal-plans/p1', () => HttpResponse.json(plan)));
    render(<PlanDetail planId="p1" />);
    await waitFor(() => screen.getByText('Week of May 11'));
    await user.click(screen.getByRole('button', { name: /plans/i })); // "‹ Plans"
    expect(push).toHaveBeenCalledWith('/meal-plans');
  });

  it('tapping a meal opens the B3 editor; Done persists with the unchanged { items } payload', async () => {
    const user = userEvent.setup();
    let putBody: unknown = null;
    server.use(
      http.get('/api/meal-plans/p1', () => HttpResponse.json(plan)),
      http.put('/api/meal-plans/p1', async ({ request }) => {
        putBody = await request.json();
        return HttpResponse.json({ ...plan, ...(putBody as object) });
      })
    );
    render(<PlanDetail planId="p1" />);
    await waitFor(() => screen.getByText('Week of May 11'));
    await user.click(screen.getAllByText('Lemon ricotta pasta')[0]);
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(putBody).not.toBeNull());
    expect(putBody).toHaveProperty('items'); // same payload shape as today
    expect(Object.keys(putBody as object)).toHaveLength(1); // items is the ONLY key — no write-logic drift
  });

  it('renders a not-found state when the plan 404s', async () => {
    server.use(http.get('/api/meal-plans/p1', () => new HttpResponse(null, { status: 404 })));
    render(<PlanDetail planId="p1" />);
    await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument());
  });
});
