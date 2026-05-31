import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PendingInviteBanner } from '../PendingInviteBanner';
import { renderWithTheme } from '@/test-utils/renderWithTheme';

describe('PendingInviteBanner', () => {
  it('renders the store name and inviter', () => {
    renderWithTheme(
      <PendingInviteBanner
        invite={{ storeId: 's9', storeName: 'Sara’s store', inviterName: 'Sara' }}
        onAccept={() => {}}
        onDecline={() => {}}
      />
    );
    expect(screen.getByText(/Sara’s store/)).toBeInTheDocument();
    expect(screen.getByText(/invited by sara/i)).toBeInTheDocument();
  });

  it('calls onAccept with the store id', async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    renderWithTheme(
      <PendingInviteBanner
        invite={{ storeId: 's9', storeName: 'Sara’s store', inviterName: 'Sara' }}
        onAccept={onAccept}
        onDecline={() => {}}
      />
    );
    await user.click(screen.getByRole('button', { name: /accept/i }));
    expect(onAccept).toHaveBeenCalledWith('s9');
  });

  it('calls onDecline with the store id', async () => {
    const user = userEvent.setup();
    const onDecline = vi.fn();
    renderWithTheme(
      <PendingInviteBanner
        invite={{ storeId: 's9', storeName: 'Sara’s store', inviterName: 'Sara' }}
        onAccept={() => {}}
        onDecline={onDecline}
      />
    );
    await user.click(screen.getByRole('button', { name: /decline/i }));
    expect(onDecline).toHaveBeenCalledWith('s9');
  });
});
