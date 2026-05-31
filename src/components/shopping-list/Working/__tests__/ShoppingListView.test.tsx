import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ShoppingListView } from '../ShoppingListView';
import { renderWithTheme, stubHandlers } from '@/test-utils/renderWithTheme';
const stores = [
  { _id: 's1', name: 'Corner market', emoji: '🛒', itemCount: 1 },
  { _id: 's2', name: 'Greenleaf', emoji: '🥬', itemCount: 0 },
];
const items = [{ foodItemId: 'f1', name: 'shallots', quantity: 2, unit: 'each', checked: false }];
describe('ShoppingListView (two-pane selection)', () => {
  it('renders the active store list beside the sidebar and switches on sidebar click', async () => {
    const user = userEvent.setup();
    const onSelectStore = vi.fn();
    renderWithTheme(
      <ShoppingListView
        stores={stores}
        activeStoreId="s1"
        items={items}
        onSelectStore={onSelectStore}
        {...stubHandlers()}
      />
    );
    expect(screen.getByText('Corner market')).toBeInTheDocument();
    expect(screen.getByText('shallots')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Greenleaf/ }));
    expect(onSelectStore).toHaveBeenCalledWith('s2');
  });
});
