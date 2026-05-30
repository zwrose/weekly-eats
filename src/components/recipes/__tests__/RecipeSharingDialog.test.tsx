// src/components/recipes/__tests__/RecipeSharingDialog.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeSharingDialog } from '../RecipeSharingDialog';
import type { PendingRecipeInvitation } from '@/lib/recipe-sharing-utils';

afterEach(cleanup);

const baseProps = {
  open: true,
  onClose: vi.fn(),
  pendingInvitations: [
    {
      ownerId: 'o1',
      ownerEmail: 'sara@x.com',
      ownerName: 'Sara',
      invitation: {
        userId: 'p1',
        userEmail: 'me@x.com',
        userName: 'Me',
        status: 'pending' as const,
        invitedBy: 'o1',
        invitedAt: '2026-05-01',
        sharingTypes: ['tags', 'ratings'] as ('tags' | 'ratings')[],
      },
    },
  ] satisfies PendingRecipeInvitation[],
  onAcceptInvitation: vi.fn(),
  onRejectInvitation: vi.fn(),
  shareTags: true,
  onShareTagsChange: vi.fn(),
  shareRatings: true,
  onShareRatingsChange: vi.fn(),
  shareEmail: '',
  onShareEmailChange: vi.fn(),
  onInviteUser: vi.fn(),
  sharedUsers: [
    {
      userId: 's1',
      email: 'casey@x.com',
      name: 'Casey',
      sharingTypes: ['tags'] as ('tags' | 'ratings')[],
    },
  ],
  onRemoveUser: vi.fn(),
};

describe('RecipeSharingDialog', () => {
  it('renders pending invitations and shared users', () => {
    render(<RecipeSharingDialog {...baseProps} />);
    expect(screen.getByText('Sara')).toBeInTheDocument();
    expect(screen.getByText('Casey')).toBeInTheDocument();
  });

  it('accept / reject fire with the invitee userId', async () => {
    const user = userEvent.setup();
    const onAcceptInvitation = vi.fn();
    render(<RecipeSharingDialog {...baseProps} onAcceptInvitation={onAcceptInvitation} />);
    await user.click(screen.getByRole('button', { name: /accept sara/i }));
    expect(onAcceptInvitation).toHaveBeenCalledWith('p1');
  });

  it('Invite fires onInviteUser; remove fires onRemoveUser', async () => {
    const user = userEvent.setup();
    const onInviteUser = vi.fn();
    const onRemoveUser = vi.fn();
    render(
      <RecipeSharingDialog
        {...baseProps}
        shareEmail="new@x.com"
        onInviteUser={onInviteUser}
        onRemoveUser={onRemoveUser}
      />
    );
    await user.click(screen.getByRole('button', { name: /^invite$/i }));
    expect(onInviteUser).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /remove casey/i }));
    expect(onRemoveUser).toHaveBeenCalledWith('s1');
  });
});
