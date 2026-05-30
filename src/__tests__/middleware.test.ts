// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { JWT } from 'next-auth/jwt';
import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { middleware } from '../middleware';

vi.mock('next-auth/jwt', () => ({ getToken: vi.fn() }));
const mockGetToken = vi.mocked(getToken);

const req = (path: string) => new NextRequest(new URL(`https://app.test${path}`));

describe('middleware approval gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 JSON for an unapproved token on an API route', async () => {
    mockGetToken.mockResolvedValue({ isApproved: false, isAdmin: false } as JWT);

    const res = await middleware(req('/api/meal-plans'));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden' });
  });

  it('redirects an unapproved token to /pending-approval for a page route', async () => {
    mockGetToken.mockResolvedValue({ isApproved: false, isAdmin: false } as JWT);

    const res = await middleware(req('/recipes'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://app.test/pending-approval');
  });

  it('treats a token with no isApproved claim as unapproved (fail-closed)', async () => {
    mockGetToken.mockResolvedValue({ isAdmin: false } as JWT);

    const res = await middleware(req('/api/recipes'));

    expect(res.status).toBe(403);
  });

  it('lets an unapproved token reach exempt paths', async () => {
    mockGetToken.mockResolvedValue({ isApproved: false } as JWT);

    for (const path of ['/pending-approval', '/api/user/approval-status', '/api/avatar']) {
      const res = await middleware(req(path));
      expect(res.headers.get('x-middleware-next')).toBe('1'); // NextResponse.next()
    }
  });

  it('lets an unapproved token reach /api/auth/* (sign-out must work)', async () => {
    mockGetToken.mockResolvedValue({ isApproved: false } as JWT);

    const res = await middleware(req('/api/auth/signout'));

    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('passes an approved token through', async () => {
    mockGetToken.mockResolvedValue({ isApproved: true } as JWT);

    const res = await middleware(req('/api/meal-plans'));

    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('passes an unapproved ADMIN token through (admins bypass approval)', async () => {
    mockGetToken.mockResolvedValue({ isApproved: false, isAdmin: true } as JWT);

    const res = await middleware(req('/api/admin/users'));

    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('redirects to / when there is no token (existing behavior)', async () => {
    mockGetToken.mockResolvedValue(null);

    const res = await middleware(req('/recipes'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://app.test/?callbackUrl=%2Frecipes');
  });
});
