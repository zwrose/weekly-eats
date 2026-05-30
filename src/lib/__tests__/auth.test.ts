import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { JWT } from 'next-auth/jwt';
import type { Session } from 'next-auth';

const mockGetMongoClient = vi.fn();

vi.mock('@/lib/mongodb', () => ({ getMongoClient: mockGetMongoClient }));
vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));
// Avoid noisy error logging during the jwt error-path test
vi.mock('@/lib/errors', () => ({ logError: vi.fn() }));

const authConfig = (await import('../auth.config')).default;
const { jwtCallback } = await import('../auth');

const redirect = authConfig.callbacks.redirect;
const session = authConfig.callbacks.session;
const baseUrl = 'https://app.example.com';
const PREVIEW = 'https://weekly-eats-feat-x-zach-roses-projects.vercel.app';

describe('config wiring', () => {
  it('enables trustHost and wires the redirect proxy from env', () => {
    expect(authConfig.trustHost).toBe(true);
    expect('redirectProxyUrl' in authConfig).toBe(true);
  });
});

describe('redirect callback', () => {
  it('resolves a relative path against baseUrl', () => {
    expect(redirect({ url: '/dashboard', baseUrl })).toBe(`${baseUrl}/dashboard`);
  });
  it('returns a same-origin absolute URL unchanged', () => {
    const url = `${baseUrl}/recipes`;
    expect(redirect({ url, baseUrl })).toBe(url);
  });
  it('falls back to baseUrl for a foreign origin', () => {
    expect(redirect({ url: 'https://evil.com', baseUrl })).toBe(baseUrl);
  });
  it('accepts a valid preview origin (no path)', () => {
    expect(redirect({ url: PREVIEW, baseUrl })).toBe(PREVIEW);
  });
  it('accepts a valid preview origin carrying a path', () => {
    const url = `${PREVIEW}/meal-plans`;
    expect(redirect({ url, baseUrl })).toBe(url);
  });
  it('accepts the production origin', () => {
    const url = 'https://weekly-eats.vercel.app/recipes';
    expect(redirect({ url, baseUrl })).toBe(url);
  });
  it('rejects a suffix-attack lookalike host (→ baseUrl)', () => {
    const url = 'https://weekly-eats-x-zach-roses-projects.vercel.app.evil.com/cb';
    expect(redirect({ url, baseUrl })).toBe(baseUrl);
  });
});

describe('session callback', () => {
  it('maps token fields onto session.user', () => {
    const token = { isAdmin: true, isApproved: false, sub: 'u1' } as JWT;
    const result = session({ session: { user: {} } as Session, token }) as Session;
    expect(result.user.id).toBe('u1');
    expect(result.user.isAdmin).toBe(true);
    expect(result.user.isApproved).toBe(false);
  });
});

describe('jwt callback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('defaults admin/approved to false when the DB lookup fails', async () => {
    mockGetMongoClient.mockRejectedValue(new Error('DB down'));
    const result = await jwtCallback({
      token: { email: 'user@example.com' } as JWT,
      trigger: 'signIn',
    });
    expect(result.isAdmin).toBe(false);
    expect(result.isApproved).toBe(false);
  });

  it('caches isAdmin/isApproved from the DB user on signIn', async () => {
    const findOne = vi.fn().mockResolvedValue({ isAdmin: true, isApproved: true });
    mockGetMongoClient.mockResolvedValue({ db: () => ({ collection: () => ({ findOne }) }) });
    const result = await jwtCallback({
      token: { email: 'admin@example.com' } as JWT,
      trigger: 'signIn',
    });
    expect(findOne).toHaveBeenCalledWith({ email: 'admin@example.com' });
    expect(result.isAdmin).toBe(true);
    expect(result.isApproved).toBe(true);
  });

  it('coerces missing DB user fields to false (no implicit admin/approval)', async () => {
    const findOne = vi.fn().mockResolvedValue(null);
    mockGetMongoClient.mockResolvedValue({ db: () => ({ collection: () => ({ findOne }) }) });
    const result = await jwtCallback({
      token: { email: 'ghost@example.com' } as JWT,
      trigger: 'signIn',
    });
    expect(result.isAdmin).toBe(false);
    expect(result.isApproved).toBe(false);
  });

  it('re-reads isApproved from the DB on the update trigger', async () => {
    const findOne = vi.fn().mockResolvedValue({ isAdmin: false, isApproved: true });
    mockGetMongoClient.mockResolvedValue({ db: () => ({ collection: () => ({ findOne }) }) });
    const token = { email: 'user@example.com', isAdmin: false, isApproved: false } as JWT;
    const result = await jwtCallback({ token, trigger: 'update' });
    expect(findOne).toHaveBeenCalledWith({ email: 'user@example.com' });
    expect(result.isApproved).toBe(true);
  });

  it('fetches DB claims on first hydration when isAdmin is undefined (no trigger)', async () => {
    const findOne = vi.fn().mockResolvedValue({ isAdmin: false, isApproved: true });
    mockGetMongoClient.mockResolvedValue({ db: () => ({ collection: () => ({ findOne }) }) });
    const result = await jwtCallback({ token: { email: 'u@example.com' } as JWT });
    expect(findOne).toHaveBeenCalled();
    expect(result.isApproved).toBe(true);
  });
});
