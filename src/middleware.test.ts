import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth/jwt', () => ({ getToken: vi.fn() }));

const { getToken } = await import('next-auth/jwt');
const { middleware } = await import('./middleware');

const req = (path: string) => new NextRequest(new URL(`http://localhost${path}`));

beforeEach(() => {
  (getToken as any).mockReset();
});

describe('middleware approval gating', () => {
  it('lets the public home page through without a token', async () => {
    const res = await middleware(req('/'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects unauthenticated users to / with a callbackUrl', async () => {
    (getToken as any).mockResolvedValueOnce(null);
    const res = await middleware(req('/meal-plans'));
    expect(res.headers.get('location')).toContain('/');
    expect(res.headers.get('location')).toContain('callbackUrl=%2Fmeal-plans');
  });

  it('lets an approved user reach protected pages', async () => {
    (getToken as any).mockResolvedValueOnce({ isApproved: true, isAdmin: false });
    const res = await middleware(req('/meal-plans'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('lets an admin through even if not approved', async () => {
    (getToken as any).mockResolvedValueOnce({ isApproved: false, isAdmin: true });
    const res = await middleware(req('/user-management'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects an unapproved non-admin to /pending-approval', async () => {
    (getToken as any).mockResolvedValueOnce({ isApproved: false, isAdmin: false });
    const res = await middleware(req('/meal-plans'));
    expect(res.headers.get('location')).toContain('/pending-approval');
  });

  it('does not loop when the unapproved user is already on /pending-approval', async () => {
    (getToken as any).mockResolvedValueOnce({ isApproved: false, isAdmin: false });
    const res = await middleware(req('/pending-approval'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('lets the unapproved user poll the approval-status API', async () => {
    (getToken as any).mockResolvedValueOnce({ isApproved: false, isAdmin: false });
    const res = await middleware(req('/api/user/approval-status'));
    expect(res.headers.get('location')).toBeNull();
    expect(res.status).not.toBe(403);
  });

  it('returns 403 JSON (not an HTML redirect) for other API calls by unapproved users', async () => {
    (getToken as any).mockResolvedValueOnce({ isApproved: false, isAdmin: false });
    const res = await middleware(req('/api/meal-plans'));
    expect(res.status).toBe(403);
    expect(res.headers.get('location')).toBeNull();
  });
});
