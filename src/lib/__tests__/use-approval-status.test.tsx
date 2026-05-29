import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useApprovalStatus } from '../use-approval-status';

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));

const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockPush = vi.fn();

const sessionValue = (user: Record<string, unknown>) =>
  ({ data: { user }, update: mockUpdate }) as unknown as ReturnType<typeof useSession>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useRouter).mockReturnValue({
    push: mockPush,
  } as unknown as ReturnType<typeof useRouter>);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// NOTE: stubbing global.fetch is safe here despite the CLAUDE.md MSW gotcha —
// /api/user/approval-status has no MSW handler (MSW is onUnhandledRequest:'bypass')
// and afterEach unstubs. Do NOT copy this onto a test that relies on MSW handlers.
describe('useApprovalStatus', () => {
  it('refreshes the token and redirects to /meal-plans when newly approved', async () => {
    vi.mocked(useSession).mockReturnValue(
      sessionValue({ email: 'u@x.com', isApproved: false, isAdmin: false })
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ isApproved: true, isAdmin: false }),
      })
    );

    renderHook(() => useApprovalStatus());

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ isApproved: true }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/meal-plans'));
  });

  it('refreshes and redirects to /pending-approval when approval is revoked', async () => {
    vi.mocked(useSession).mockReturnValue(
      sessionValue({ email: 'u@x.com', isApproved: true, isAdmin: false })
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ isApproved: false, isAdmin: false }),
      })
    );

    renderHook(() => useApprovalStatus());

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ isApproved: false }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/pending-approval'));
  });

  it('does NOT update or redirect when polled status matches session (isApproved:false steady state)', async () => {
    vi.mocked(useSession).mockReturnValue(
      sessionValue({ email: 'u@x.com', isApproved: false, isAdmin: false })
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ isApproved: false, isAdmin: false }),
      })
    );

    renderHook(() => useApprovalStatus());

    // Wait well past the 100ms setTimeout so any spurious redirect would have fired
    await new Promise((r) => setTimeout(r, 200));

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does NOT update or redirect when polled status matches session (isApproved:true steady state)', async () => {
    vi.mocked(useSession).mockReturnValue(
      sessionValue({ email: 'u@x.com', isApproved: true, isAdmin: false })
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ isApproved: true, isAdmin: false }),
      })
    );

    renderHook(() => useApprovalStatus());

    // Wait well past the 100ms setTimeout so any spurious redirect would have fired
    await new Promise((r) => setTimeout(r, 200));

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
