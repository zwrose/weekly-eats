import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { JWT } from 'next-auth/jwt';
import type { Session } from 'next-auth';

const mockGetMongoClient = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: mockGetMongoClient,
}));

vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) }));

// Avoid noisy error logging during the jwt error-path test
vi.mock('@/lib/errors', () => ({ logError: vi.fn() }));

const { authOptions } = await import('../auth');

const callbacks = authOptions.callbacks!;
const baseUrl = 'https://app.example.com';

describe('redirect callback', () => {
  it('resolves a relative path against baseUrl', async () => {
    const result = await callbacks.redirect!({ url: '/dashboard', baseUrl });
    expect(result).toBe(`${baseUrl}/dashboard`);
  });

  it('returns a same-origin absolute URL unchanged', async () => {
    const url = `${baseUrl}/recipes`;
    const result = await callbacks.redirect!({ url, baseUrl });
    expect(result).toBe(url);
  });

  it('falls back to baseUrl for a foreign origin', async () => {
    const result = await callbacks.redirect!({ url: 'https://evil.com', baseUrl });
    expect(result).toBe(baseUrl);
  });
});

describe('session callback', () => {
  it('maps token fields onto session.user', async () => {
    const token = { isAdmin: true, isApproved: false, sub: 'u1' } as JWT;
    const session = { user: {} } as Session;

    const result = (await callbacks.session!({
      session,
      token,
    } as Parameters<NonNullable<typeof callbacks.session>>[0])) as Session;

    expect(result.user.id).toBe('u1');
    expect(result.user.isAdmin).toBe(true);
    expect(result.user.isApproved).toBe(false);
  });
});

describe('jwt callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults admin/approved to false when the DB lookup fails', async () => {
    mockGetMongoClient.mockRejectedValue(new Error('DB down'));
    const token = { email: 'user@example.com' } as JWT;

    const result = await callbacks.jwt!({
      token,
      trigger: 'signIn',
    } as Parameters<NonNullable<typeof callbacks.jwt>>[0]);

    expect(result.isAdmin).toBe(false);
    expect(result.isApproved).toBe(false);
  });

  it('caches isAdmin/isApproved from the DB user on signIn', async () => {
    const findOne = vi.fn().mockResolvedValue({ isAdmin: true, isApproved: true });
    mockGetMongoClient.mockResolvedValue({
      db: () => ({ collection: () => ({ findOne }) }),
    });
    const token = { email: 'admin@example.com' } as JWT;

    const result = await callbacks.jwt!({
      token,
      trigger: 'signIn',
    } as Parameters<NonNullable<typeof callbacks.jwt>>[0]);

    expect(findOne).toHaveBeenCalledWith({ email: 'admin@example.com' });
    expect(result.isAdmin).toBe(true);
    expect(result.isApproved).toBe(true);
  });

  it('coerces missing DB user fields to false (no implicit admin/approval)', async () => {
    const findOne = vi.fn().mockResolvedValue(null);
    mockGetMongoClient.mockResolvedValue({
      db: () => ({ collection: () => ({ findOne }) }),
    });
    const token = { email: 'ghost@example.com' } as JWT;

    const result = await callbacks.jwt!({
      token,
      trigger: 'signIn',
    } as Parameters<NonNullable<typeof callbacks.jwt>>[0]);

    expect(result.isAdmin).toBe(false);
    expect(result.isApproved).toBe(false);
  });

  it('re-reads isApproved from the DB on the update trigger', async () => {
    const findOne = vi.fn().mockResolvedValue({ isAdmin: false, isApproved: true });
    mockGetMongoClient.mockResolvedValue({
      db: () => ({ collection: () => ({ findOne }) }),
    });
    // Token is already populated from sign-in (isAdmin defined) and stale.
    const token = { email: 'user@example.com', isAdmin: false, isApproved: false } as JWT;

    const result = await callbacks.jwt!({
      token,
      trigger: 'update',
    } as Parameters<NonNullable<typeof callbacks.jwt>>[0]);

    expect(findOne).toHaveBeenCalledWith({ email: 'user@example.com' });
    expect(result.isApproved).toBe(true);
  });

  it('does not let the update payload override the DB (no self-approval)', async () => {
    const findOne = vi.fn().mockResolvedValue({ isAdmin: false, isApproved: false });
    mockGetMongoClient.mockResolvedValue({
      db: () => ({ collection: () => ({ findOne }) }),
    });
    const token = { email: 'attacker@example.com', isAdmin: false, isApproved: false } as JWT;

    const result = await callbacks.jwt!({
      token,
      trigger: 'update',
      session: { isApproved: true }, // attacker-supplied; must be ignored
    } as Parameters<NonNullable<typeof callbacks.jwt>>[0]);

    expect(result.isApproved).toBe(false);
  });
});
