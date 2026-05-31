import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ShareStoreDialog, type ShareStoreInvitation } from '../ShareStoreDialog';
import { renderWithTheme } from '@/test-utils/renderWithTheme';

function baseProps(overrides: Partial<React.ComponentProps<typeof ShareStoreDialog>> = {}) {
  return {
    open: true,
    storeName: 'Target',
    invitations: [] as ShareStoreInvitation[],
    email: '',
    onEmailChange: vi.fn(),
    onInvite: vi.fn(),
    onRemove: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe('ShareStoreDialog', () => {
  it('typing an address and clicking Invite fires the invite handler', async () => {
    const user = userEvent.setup();
    const onEmailChange = vi.fn();
    const onInvite = vi.fn();
    // email is controlled by the page, so render with a non-empty email to enable Invite.
    renderWithTheme(
      <ShareStoreDialog {...baseProps({ email: 'a@b.com', onEmailChange, onInvite })} />
    );

    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'x');
    expect(onEmailChange).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /^invite$/i }));
    expect(onInvite).toHaveBeenCalled();
  });

  it('disables Invite when the email is empty', () => {
    renderWithTheme(<ShareStoreDialog {...baseProps({ email: '' })} />);
    expect(screen.getByRole('button', { name: /^invite$/i })).toBeDisabled();
  });

  it('lists shared users and fires onRemove for accepted ones', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    renderWithTheme(
      <ShareStoreDialog
        {...baseProps({
          onRemove,
          invitations: [
            { userId: 'u1', userEmail: 'accepted@b.com', status: 'accepted' },
            { userId: 'u2', userEmail: 'pending@b.com', status: 'pending' },
          ],
        })}
      />
    );

    expect(screen.getByText('accepted@b.com')).toBeInTheDocument();
    expect(screen.getByText('pending@b.com')).toBeInTheDocument();

    // Only the accepted user has a remove control.
    await user.click(screen.getByRole('button', { name: /remove accepted@b\.com/i }));
    expect(onRemove).toHaveBeenCalledWith('u1');
    expect(screen.queryByRole('button', { name: /remove pending@b\.com/i })).toBeNull();
  });
});
