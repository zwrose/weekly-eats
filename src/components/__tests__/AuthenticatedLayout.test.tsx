import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const { useApprovalStatusMock, useSessionMock, pushMock, usePathnameMock } = vi.hoisted(() => ({
  useApprovalStatusMock: vi.fn(() => ({ isRedirecting: false })),
  useSessionMock: vi.fn(() => ({
    data: { user: { name: 'Zach Rose', isApproved: true, isAdmin: false } },
  })),
  pushMock: vi.fn(),
  usePathnameMock: vi.fn(() => '/meal-plans'),
}));
vi.mock('../../lib/use-approval-status', () => ({ useApprovalStatus: useApprovalStatusMock }));
vi.mock('next-auth/react', () => ({ useSession: useSessionMock }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: usePathnameMock,
}));
// Mock the chrome + section provider so the layout's own logic is what we exercise.
vi.mock('../nav/TopNav', () => ({ TopNav: () => <div data-testid="topnav" /> }));
vi.mock('../nav/BottomNav', () => ({ BottomNav: () => <div data-testid="bottomnav" /> }));
vi.mock('../nav/SectionThemeProvider', () => ({
  SectionThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import AuthenticatedLayout from '../AuthenticatedLayout';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
beforeEach(() => {
  useApprovalStatusMock.mockReturnValue({ isRedirecting: false });
  useSessionMock.mockReturnValue({
    data: { user: { name: 'Zach Rose', isApproved: true, isAdmin: false } },
  });
  usePathnameMock.mockReturnValue('/meal-plans');
});

describe('AuthenticatedLayout', () => {
  it('mounts the approval-status gate (load-bearing — must survive the Chunk 2 rewrite)', () => {
    render(
      <AuthenticatedLayout>
        <span>content</span>
      </AuthenticatedLayout>
    );
    expect(useApprovalStatusMock).toHaveBeenCalled();
  });

  it('renders children + chrome for an approved user', () => {
    const { getByText, getByTestId } = render(
      <AuthenticatedLayout>
        <span>content</span>
      </AuthenticatedLayout>
    );
    expect(getByText('content')).toBeInTheDocument();
    expect(getByTestId('topnav')).toBeInTheDocument();
    expect(getByTestId('bottomnav')).toBeInTheDocument();
  });

  it('redirects an unapproved user to /pending-approval and hides the chrome', () => {
    useSessionMock.mockReturnValue({
      data: { user: { name: 'X', isApproved: false, isAdmin: false } },
    });
    usePathnameMock.mockReturnValue('/meal-plans');
    const { queryByTestId } = render(
      <AuthenticatedLayout>
        <span>content</span>
      </AuthenticatedLayout>
    );
    expect(pushMock).toHaveBeenCalledWith('/pending-approval');
    expect(queryByTestId('topnav')).not.toBeInTheDocument();
  });

  it('does not redirect an unapproved user already on /pending-approval', () => {
    useSessionMock.mockReturnValue({
      data: { user: { name: 'X', isApproved: false, isAdmin: false } },
    });
    usePathnameMock.mockReturnValue('/pending-approval');
    render(
      <AuthenticatedLayout>
        <span>content</span>
      </AuthenticatedLayout>
    );
    expect(pushMock).not.toHaveBeenCalled();
  });
});
