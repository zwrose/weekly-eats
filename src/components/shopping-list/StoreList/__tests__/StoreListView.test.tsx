import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { StoreListView } from '../StoreListView';
import { PendingInviteBanner } from '../PendingInviteBanner';
import { renderWithTheme } from '@/test-utils/renderWithTheme';

const stores = [
  { _id: 's1', name: 'Corner market', emoji: '🛒', itemCount: 3 },
  { _id: 's2', name: 'Greenleaf', emoji: '🥬', itemCount: 0 },
];

describe('StoreListView', () => {
  it('renders each store with its name and to-buy count', () => {
    renderWithTheme(
      <StoreListView stores={stores} onSelectStore={() => {}} onAddStore={() => {}} />
    );
    expect(screen.getByText('Corner market')).toBeInTheDocument();
    expect(screen.getByText(/3 to buy/i)).toBeInTheDocument();
    expect(screen.getByText(/list empty/i)).toBeInTheDocument(); // s2 has 0
  });
  it('calls onSelectStore with the store id when a row is clicked', async () => {
    const user = userEvent.setup();
    const onSelectStore = vi.fn();
    renderWithTheme(
      <StoreListView stores={stores} onSelectStore={onSelectStore} onAddStore={() => {}} />
    );
    await user.click(screen.getByRole('button', { name: /Corner market/ }));
    expect(onSelectStore).toHaveBeenCalledWith('s1');
  });
});

describe('PendingInviteBanner', () => {
  it('renders an accept and decline control for a pending invite', async () => {
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
});
