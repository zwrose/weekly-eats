import type { Session } from 'next-auth';

type SessionUserOverrides = Partial<Session['user']>;

/**
 * Build a mock NextAuth session for an APPROVED user.
 * Defaults: id 'u1', approved, non-admin. Override any field (id/email/isAdmin/
 * isApproved) to match a given route test's expectations.
 */
export const approvedSession = (overrides: SessionUserOverrides = {}): Session => ({
  user: {
    id: 'u1',
    email: 'user@test.com',
    isAdmin: false,
    isApproved: true,
    ...overrides,
  },
  expires: '2099-01-01T00:00:00.000Z',
});

/**
 * Build a mock NextAuth session for an UNAPPROVED user (signed in, awaiting
 * admin approval). Same overrides as approvedSession.
 */
export const unapprovedSession = (overrides: SessionUserOverrides = {}): Session =>
  approvedSession({ isApproved: false, ...overrides });
