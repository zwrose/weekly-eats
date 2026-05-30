// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { Session } from 'next-auth';

// The auth wrapper becomes a pass-through: middleware === the handler we wrote.
vi.mock('next-auth', () => ({
  default: () => ({ auth: (handler: unknown) => handler }),
}));
vi.mock('@/lib/auth.config', () => ({ default: {} }));

const { middleware } = await import('../middleware');

// Build a request with a synthetic req.auth (Session | null), as the real
// wrapper would inject. `auth` is attached the way the wrapper extends the request.
function req(path: string, auth: Session | null) {
  const r = new NextRequest(new URL(`https://app.test${path}`));
  return Object.assign(r, { auth });
}

const approved = (over: Partial<Session['user']> = {}): Session =>
  ({
    user: { id: 'u1', isAdmin: false, isApproved: true, ...over },
    expires: '2099-01-01',
  }) as Session;
const unapproved = (over: Partial<Session['user']> = {}): Session =>
  approved({ isApproved: false, ...over });

describe('middleware approval gate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 JSON for an unapproved session on an API route', async () => {
    const res = await middleware(req('/api/meal-plans', unapproved()));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden' });
  });

  it('redirects an unapproved session to /pending-approval for a page route', async () => {
    const res = await middleware(req('/recipes', unapproved()));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://app.test/pending-approval');
  });

  it('treats a session with no isApproved claim as unapproved (fail-closed)', async () => {
    const res = await middleware(req('/api/recipes', approved({ isApproved: undefined })));
    expect(res.status).toBe(403);
  });

  it('lets an unapproved session reach exempt paths', async () => {
    for (const path of ['/pending-approval', '/api/user/approval-status', '/api/avatar']) {
      const res = await middleware(req(path, unapproved()));
      expect(res.headers.get('x-middleware-next')).toBe('1');
    }
  });

  it('lets an unapproved session reach /api/auth/* (sign-out must work)', async () => {
    const res = await middleware(req('/api/auth/signout', unapproved()));
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('passes an approved session through', async () => {
    const res = await middleware(req('/api/meal-plans', approved()));
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('passes an unapproved ADMIN session through (admins bypass approval)', async () => {
    const res = await middleware(req('/api/admin/users', unapproved({ isAdmin: true })));
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('redirects to / when there is no session (existing behavior)', async () => {
    const res = await middleware(req('/recipes', null));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://app.test/?callbackUrl=%2Frecipes');
  });
});
