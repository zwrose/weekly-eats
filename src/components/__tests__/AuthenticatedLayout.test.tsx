import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const { useApprovalStatusMock } = vi.hoisted(() => ({
  useApprovalStatusMock: vi.fn(() => ({ isRedirecting: false })),
}));
vi.mock('../../lib/use-approval-status', () => ({
  useApprovalStatus: useApprovalStatusMock,
}));
vi.mock('../Header', () => ({ default: () => <div data-testid="header" /> }));
vi.mock('../BottomNav', () => ({ default: () => <div data-testid="bottomnav" /> }));

import AuthenticatedLayout from '../AuthenticatedLayout';

afterEach(() => {
  cleanup();
  useApprovalStatusMock.mockClear();
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

  it('renders children when not redirecting', () => {
    const { getByText } = render(
      <AuthenticatedLayout>
        <span>content</span>
      </AuthenticatedLayout>
    );
    expect(getByText('content')).toBeInTheDocument();
  });
});
