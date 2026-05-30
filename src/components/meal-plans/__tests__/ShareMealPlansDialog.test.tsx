import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareMealPlansDialog } from '../ShareMealPlansDialog';
import type { PendingMealPlanInvitation, SharedUser } from '@/lib/meal-plan-sharing-utils';

afterEach(cleanup);

const pending: PendingMealPlanInvitation[] = [
  {
    ownerId: 'o1',
    ownerEmail: 'sara@example.com',
    ownerName: 'Sara Rose',
    invitation: { userId: 'o1', status: 'pending', invitedAt: new Date('2026-01-01') },
  },
];
const shared: SharedUser[] = [{ userId: 'u2', email: 'casey@example.com', name: 'Casey Lin' }];

const baseProps = {
  open: true,
  onClose: vi.fn(),
  pendingInvitations: [],
  sharedUsers: [],
  email: '',
  onEmailChange: vi.fn(),
  onInvite: vi.fn(),
  onAccept: vi.fn(),
  onReject: vi.fn(),
  onRemove: vi.fn(),
};

describe('ShareMealPlansDialog', () => {
  it('renders pending invitations and accept/decline call the handlers with the owner id', async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    const onReject = vi.fn();
    render(
      <ShareMealPlansDialog
        {...baseProps}
        pendingInvitations={pending}
        onAccept={onAccept}
        onReject={onReject}
      />
    );
    expect(screen.getByText('Pending invitations · 1')).toBeInTheDocument();
    expect(screen.getByText('Sara Rose')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /accept invitation from Sara Rose/i }));
    expect(onAccept).toHaveBeenCalledWith('o1');
    await user.click(screen.getByRole('button', { name: /decline invitation from Sara Rose/i }));
    expect(onReject).toHaveBeenCalledWith('o1');
  });

  it('lists shared users and remove calls onRemove with the user id', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<ShareMealPlansDialog {...baseProps} sharedUsers={shared} onRemove={onRemove} />);
    expect(screen.getByText('Casey Lin')).toBeInTheDocument();
    expect(screen.getByText('casey@example.com')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /remove Casey Lin/i }));
    expect(onRemove).toHaveBeenCalledWith('u2');
  });

  it('invite is disabled until an email is entered; Invite + Enter both fire onInvite', async () => {
    const user = userEvent.setup();
    const onInvite = vi.fn();
    const { rerender } = render(
      <ShareMealPlansDialog {...baseProps} email="" onInvite={onInvite} />
    );
    expect(screen.getByRole('button', { name: 'Invite' })).toBeDisabled();

    rerender(
      <ShareMealPlansDialog {...baseProps} email="friend@example.com" onInvite={onInvite} />
    );
    await user.click(screen.getByRole('button', { name: 'Invite' }));
    expect(onInvite).toHaveBeenCalledTimes(1);

    await user.type(screen.getByRole('textbox', { name: /email address/i }), '{Enter}');
    expect(onInvite).toHaveBeenCalledTimes(2);
  });

  it('auto-focuses the email field when opened', async () => {
    render(<ShareMealPlansDialog {...baseProps} />);
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /email address/i })).toHaveFocus()
    );
  });

  it('shows an empty state when there are no invitations or shared users', () => {
    render(<ShareMealPlansDialog {...baseProps} />);
    expect(screen.getByText(/no one yet/i)).toBeInTheDocument();
  });
});
