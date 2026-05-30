import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { StoreSidebar } from '../StoreSidebar';
const stores = [
  { _id: 's1', name: 'Corner market', emoji: '🛒', itemCount: 3 },
  { _id: 's2', name: 'Greenleaf', emoji: '🥬', itemCount: 0 },
];
describe('StoreSidebar', () => {
  it('marks the active store row', () => {
    render(
      <StoreSidebar stores={stores} activeStoreId="s1" onSelect={() => {}} onAddStore={() => {}} />
    );
    expect(screen.getByRole('button', { name: /Corner market/ })).toHaveAttribute(
      'aria-current',
      'true'
    );
    expect(screen.getByRole('button', { name: /Greenleaf/ })).toHaveAttribute(
      'aria-current',
      'false'
    );
  });
  it('calls onSelect with the store id when a different store is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <StoreSidebar stores={stores} activeStoreId="s1" onSelect={onSelect} onAddStore={() => {}} />
    );
    await user.click(screen.getByRole('button', { name: /Greenleaf/ }));
    expect(onSelect).toHaveBeenCalledWith('s2');
  });
});
