import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithTheme } from '@/test-utils/renderWithTheme';
import { PantryListView } from '../PantryListView';

afterEach(cleanup);

const ITEMS = [
  { _id: 'a', name: 'Flour' },
  { _id: 'b', name: 'Olive oil' },
];

function renderView(props: Partial<React.ComponentProps<typeof PantryListView>> = {}) {
  return renderWithTheme(
    <PantryListView
      items={ITEMS}
      total={ITEMS.length}
      onAddItem={vi.fn()}
      onDeleteItem={vi.fn()}
      {...props}
    />,
    { section: 'pantry' }
  );
}

describe('PantryListView', () => {
  it('renders the header title and item count', () => {
    renderView();
    expect(screen.getByRole('heading', { name: /pantry/i })).toBeInTheDocument();
    // count appears in the subline (accent number)
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });

  it('renders each item name', () => {
    renderView();
    // Names render in both the desktop table and mobile card (CSS-toggled).
    expect(screen.getAllByText('Flour').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Olive oil').length).toBeGreaterThan(0);
  });

  it('fires onDeleteItem with the item id when a delete button is clicked', async () => {
    const user = userEvent.setup();
    const onDeleteItem = vi.fn();
    renderView({ onDeleteItem });
    await user.click(screen.getAllByLabelText('Remove Flour')[0]);
    expect(onDeleteItem).toHaveBeenCalledWith('a');
  });

  it('fires onAddItem when the add button is clicked', async () => {
    const user = userEvent.setup();
    const onAddItem = vi.fn();
    renderView({ onAddItem });
    await user.click(screen.getAllByRole('button', { name: /add/i })[0]);
    expect(onAddItem).toHaveBeenCalledTimes(1);
  });

  it('renders the empty message when there are no items', () => {
    renderView({ items: [], total: 0, emptyMessage: <div>No pantry items yet.</div> });
    expect(screen.getByText('No pantry items yet.')).toBeInTheDocument();
    expect(screen.queryByText('Flour')).not.toBeInTheDocument();
  });
});
