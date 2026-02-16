import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StoreHistoryDialog from '../StoreHistoryDialog';
import { PurchaseHistoryRecord, ShoppingListItem } from '@/types/shopping-list';

const mockHistoryItems: PurchaseHistoryRecord[] = [
  {
    _id: 'h1',
    storeId: 'store-1',
    foodItemId: 'f1',
    name: 'Milk',
    quantity: 2,
    unit: 'gallon',
    lastPurchasedAt: new Date('2026-02-15T12:00:00Z'),
  },
  {
    _id: 'h2',
    storeId: 'store-1',
    foodItemId: 'f2',
    name: 'Bread',
    quantity: 1,
    unit: 'loaf',
    lastPurchasedAt: new Date('2026-02-14T12:00:00Z'),
  },
  {
    _id: 'h3',
    storeId: 'store-1',
    foodItemId: 'f3',
    name: 'Eggs',
    quantity: 12,
    unit: 'piece',
    lastPurchasedAt: new Date('2026-02-10T12:00:00Z'),
  },
];

const mockCurrentItems: ShoppingListItem[] = [
  { foodItemId: 'f1', name: 'Milk', quantity: 1, unit: 'gallon', checked: false },
];

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  historyItems: mockHistoryItems,
  currentItems: mockCurrentItems,
  onAddItems: vi.fn(),
  loading: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  await waitFor(() => {
    cleanup();
  }, { timeout: 100 });
});

describe('StoreHistoryDialog', () => {
  describe('Rendering', () => {
    it('renders history items', () => {
      render(<StoreHistoryDialog {...defaultProps} />);
      expect(screen.getByText('Milk')).toBeInTheDocument();
      expect(screen.getByText('Bread')).toBeInTheDocument();
      expect(screen.getByText('Eggs')).toBeInTheDocument();
    });

    it('shows quantity and unit for each item', () => {
      render(<StoreHistoryDialog {...defaultProps} />);
      expect(screen.getByText(/2 gallon/)).toBeInTheDocument();
      expect(screen.getByText(/1 loaf/)).toBeInTheDocument();
      expect(screen.getByText(/12 piece/)).toBeInTheDocument();
    });

    it('shows empty state when no history items', () => {
      render(
        <StoreHistoryDialog {...defaultProps} historyItems={[]} />
      );
      expect(screen.getByText(/no purchase history/i)).toBeInTheDocument();
    });

    it('shows loading state', () => {
      render(<StoreHistoryDialog {...defaultProps} loading={true} />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('visually distinguishes items already on the shopping list', () => {
      render(<StoreHistoryDialog {...defaultProps} />);
      // Milk is on the current list - should have "on list" indicator
      const milkRow = screen.getByText('Milk').closest('[data-testid]') || screen.getByText('Milk').parentElement;
      expect(milkRow).toHaveTextContent(/on list/i);
    });

    it('disables checkbox and add button for items already on the list', () => {
      render(<StoreHistoryDialog {...defaultProps} />);
      // Milk (f1) is on current list
      const milkItem = screen.getByTestId('history-item-f1');
      const milkCheckbox = within(milkItem).getByRole('checkbox');
      expect(milkCheckbox).toBeDisabled();

      // The add button for Milk should be disabled
      const milkAddButton = screen.getByRole('button', { name: /add milk/i });
      expect(milkAddButton).toBeDisabled();

      // Bread (f2) is NOT on current list
      const breadItem = screen.getByTestId('history-item-f2');
      const breadCheckbox = within(breadItem).getByRole('checkbox');
      expect(breadCheckbox).not.toBeDisabled();

      const breadAddButton = screen.getByRole('button', { name: /add bread/i });
      expect(breadAddButton).not.toBeDisabled();
    });
  });

  describe('Search/Filter', () => {
    it('filters history items by search query', async () => {
      const user = userEvent.setup();
      render(<StoreHistoryDialog {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'Milk');

      await waitFor(() => {
        expect(screen.getByText('Milk')).toBeInTheDocument();
        expect(screen.queryByText('Bread')).not.toBeInTheDocument();
        expect(screen.queryByText('Eggs')).not.toBeInTheDocument();
      });
    });

    it('shows no results message when filter matches nothing', async () => {
      const user = userEvent.setup();
      render(<StoreHistoryDialog {...defaultProps} />);

      await user.type(screen.getByPlaceholderText(/search/i), 'zzzzz');

      await waitFor(() => {
        expect(screen.getByText(/no items match/i)).toBeInTheDocument();
      });
    });
  });

  describe('Single add', () => {
    it('calls onAddItems when tapping an add button', async () => {
      const user = userEvent.setup();
      const onAddItems = vi.fn();
      render(<StoreHistoryDialog {...defaultProps} onAddItems={onAddItems} />);

      // Click add button on Bread (not on current list)
      const addButtons = screen.getAllByRole('button', { name: /add/i });
      // Find the add button near Bread
      const breadItem = screen.getByText('Bread').closest('li') || screen.getByText('Bread').parentElement?.parentElement;
      const addButton = breadItem ? within(breadItem as HTMLElement).getByRole('button', { name: /add/i }) : addButtons[0];
      await user.click(addButton);

      expect(onAddItems).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ foodItemId: 'f2', name: 'Bread', quantity: 1, unit: 'loaf' }),
        ])
      );
    });
  });

  describe('Multi-select', () => {
    it('allows selecting multiple items with checkboxes', async () => {
      const user = userEvent.setup();
      render(<StoreHistoryDialog {...defaultProps} />);

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]); // Bread
      await user.click(checkboxes[2]); // Eggs

      const addSelectedButton = screen.getByRole('button', { name: /add selected/i });
      expect(addSelectedButton).toBeInTheDocument();
    });

    it('calls onAddItems with all selected items', async () => {
      const user = userEvent.setup();
      const onAddItems = vi.fn();
      render(<StoreHistoryDialog {...defaultProps} onAddItems={onAddItems} />);

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]); // Bread
      await user.click(checkboxes[2]); // Eggs

      await user.click(screen.getByRole('button', { name: /add selected/i }));

      expect(onAddItems).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ foodItemId: 'f2' }),
          expect.objectContaining({ foodItemId: 'f3' }),
        ])
      );
    });
  });

  describe('Close behavior', () => {
    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<StoreHistoryDialog {...defaultProps} onClose={onClose} />);

      await user.click(screen.getByRole('button', { name: /close/i }));
      expect(onClose).toHaveBeenCalled();
    });
  });
});
