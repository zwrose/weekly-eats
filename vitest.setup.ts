import '@testing-library/jest-dom/vitest';
import { vi, beforeAll, afterEach, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
// Simplify MUI transitions to reduce async act warnings from transitions
vi.mock('@mui/material/Collapse', () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@mui/material/Fade', () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@mui/material/Grow', () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@mui/material/Slide', () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@mui/material/Zoom', () => ({ default: ({ children }: { children: React.ReactNode }) => children }));

// ReadableStream polyfill is set up in react-act.setup.ts (runs first)
// This ensures it's available before any Next.js modules are imported

// Workaround for Next.js app/router globals if needed in tests
// You can extend here as the test suite grows

// Prevent real DB adapter connection attempts during tests
vi.mock('/Users/zach.rose/weekly-eats/src/lib/mongodb-adapter.ts', () => ({
  default: Promise.resolve({}),
}));

// Ensure a dummy Mongo URI is present if any module checks it
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fake';

// Ensure jsdom has a base URL so relative fetch('/api/...') resolves
if (typeof window !== 'undefined' && window.location && window.location.href === 'about:blank') {
  window.history.replaceState({}, 'Test', 'http://localhost/');
}
// React act env flag already set at top

// MSW: mock network at fetch boundary
const handlers = [
  http.get('/api/food-items', ({ request }) => {
    const url = new URL(request.url);
    const query = (url.searchParams.get('query') || '').toLowerCase();
    const all = [
      { _id: 'f1', name: 'Apple', singularName: 'apple', pluralName: 'apples', unit: 'each' },
      { _id: 'f2', name: 'Banana', singularName: 'banana', pluralName: 'bananas', unit: 'each' },
    ];
    const filtered = query
      ? all.filter((i) => `${i.name} ${i.singularName} ${i.pluralName}`.toLowerCase().includes(query))
      : all;
    return HttpResponse.json(filtered, { status: 200 });
  }),
  http.post('/api/food-items', async ({ request }) => {
    type NewFoodItemBody = Partial<{
      name: string;
      singularName: string;
      pluralName: string;
      unit: string;
      isGlobal: boolean;
    }>;
    const body = (await request.json()) as NewFoodItemBody;
    return HttpResponse.json({ _id: 'new-food-id', ...body }, { status: 201 });
  }),
  http.get('/api/recipes', ({ request }) => {
    const url = new URL(request.url);
    const query = (url.searchParams.get('query') || '').toLowerCase();
    const all = [
      { _id: 'r1', title: 'Pasta', emoji: '🍝', isGlobal: true },
      { _id: 'r2', title: 'Salad', emoji: '🥗', isGlobal: false },
    ];
    const filtered = query ? all.filter((i) => i.title.toLowerCase().includes(query)) : all;
    return HttpResponse.json(filtered, { status: 200 });
  }),
];

const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

