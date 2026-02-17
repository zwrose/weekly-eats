import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

import MealPlanBrowser from '../MealPlanBrowser';

const summaryData = [
  { year: 2026, month: 2, count: 4, earliest: '2026-02-07', latest: '2026-02-28' },
  { year: 2026, month: 1, count: 3, earliest: '2026-01-03', latest: '2026-01-24' },
  { year: 2025, month: 12, count: 2, earliest: '2025-12-06', latest: '2025-12-20' },
];

const febPlans = [
  {
    _id: 'p1',
    name: 'Week of Feb 7',
    startDate: '2026-02-07',
    endDate: '2026-02-13',
    userId: 'u1',
    items: [],
    template: {},
  },
  {
    _id: 'p2',
    name: 'Week of Feb 14',
    startDate: '2026-02-14',
    endDate: '2026-02-20',
    userId: 'u1',
    items: [],
    template: {},
  },
];

function getUrlString(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return String(input);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: summary returns data
  mockFetch.mockImplementation((input: string | URL | Request) => {
    const url = getUrlString(input);
    if (url.includes('/api/meal-plans/summary')) {
      return Promise.resolve(new Response(JSON.stringify(summaryData), { status: 200 }));
    }
    if (url.includes('/api/meal-plans?')) {
      return Promise.resolve(new Response(JSON.stringify(febPlans), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
  });
});

afterEach(() => {
  cleanup();
});

describe('MealPlanBrowser', () => {
  it('loads and displays year/month summary', async () => {
    render(<MealPlanBrowser onPlanSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('2026')).toBeInTheDocument();
      expect(screen.getByText('2025')).toBeInTheDocument();
    });

    // Should show month entries with counts
    expect(screen.getByText(/February/)).toBeInTheDocument();
    expect(screen.getByText(/January/)).toBeInTheDocument();
    expect(screen.getByText(/December/)).toBeInTheDocument();
  });

  it('shows plan counts per month', async () => {
    render(<MealPlanBrowser onPlanSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('4')).toBeInTheDocument(); // Feb count
      expect(screen.getByText('3')).toBeInTheDocument(); // Jan count
      expect(screen.getByText('2')).toBeInTheDocument(); // Dec count
    });
  });

  it('lazy-loads plans when month is expanded', async () => {
    const user = userEvent.setup();
    render(<MealPlanBrowser onPlanSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/February/)).toBeInTheDocument();
    });

    // Click February to expand
    await user.click(screen.getByText(/February/));

    // Should fetch plans for that month
    await waitFor(() => {
      const calls = mockFetch.mock.calls.map(c => getUrlString(c[0]));
      expect(calls.some(u => u.includes('startDate=2026-02-01') && u.includes('endDate=2026-02-28'))).toBe(true);
    });

    // Should display the plans
    await waitFor(() => {
      expect(screen.getByText('Week of Feb 7')).toBeInTheDocument();
      expect(screen.getByText('Week of Feb 14')).toBeInTheDocument();
    });
  });

  it('calls onPlanSelect when a plan is clicked', async () => {
    const onPlanSelect = vi.fn();
    const user = userEvent.setup();
    render(<MealPlanBrowser onPlanSelect={onPlanSelect} />);

    await waitFor(() => {
      expect(screen.getByText(/February/)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/February/));

    await waitFor(() => {
      expect(screen.getByText('Week of Feb 7')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Week of Feb 7'));
    expect(onPlanSelect).toHaveBeenCalledWith(expect.objectContaining({ _id: 'p1' }));
  });

  it('shows loading state while fetching summary', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<MealPlanBrowser onPlanSelect={vi.fn()} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows empty state when no plans exist', async () => {
    mockFetch.mockImplementation((_input: string | URL | Request) =>
      Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
    );

    render(<MealPlanBrowser onPlanSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/no meal plan history/i)).toBeInTheDocument();
    });
  });

  it('collapses month when clicked again', async () => {
    const user = userEvent.setup();
    render(<MealPlanBrowser onPlanSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/February/)).toBeInTheDocument();
    });

    // Expand
    await user.click(screen.getByText(/February/));
    await waitFor(() => {
      expect(screen.getByText('Week of Feb 7')).toBeInTheDocument();
    });

    // Collapse
    await user.click(screen.getByText(/February/));
    await waitFor(() => {
      expect(screen.queryByText('Week of Feb 7')).not.toBeInTheDocument();
    });
  });
});
