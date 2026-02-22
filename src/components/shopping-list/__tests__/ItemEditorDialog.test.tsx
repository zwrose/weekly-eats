import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ItemEditorDialog from '../ItemEditorDialog';

const mockFetch = vi.fn();

describe('ItemEditorDialog', () => {
  const defaultProps = {
    open: true,
    mode: 'add' as const,
    excludeFoodItemIds: [] as string[],
    onClose: vi.fn(),
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/food-items') && url.includes('query=')) {
        const queryMatch = url.match(/query=([^&]*)/);
        const query = queryMatch ? decodeURIComponent(queryMatch[1]).toLowerCase() : '';
        const allItems = [
          {
            _id: 'f1',
            name: 'Apple',
            singularName: 'Apple',
            pluralName: 'Apples',
            unit: 'each',
          },
          {
            _id: 'f2',
            name: 'Banana',
            singularName: 'Banana',
            pluralName: 'Bananas',
            unit: 'each',
          },
        ];
        const filtered = allItems.filter(
          (i) =>
            i.name.toLowerCase().includes(query) ||
            i.singularName.toLowerCase().includes(query) ||
            i.pluralName.toLowerCase().includes(query)
        );
        return Promise.resolve({ ok: true, json: async () => filtered });
      }
      if (url.includes('/api/food-items')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [
              {
                _id: 'f1',
                name: 'Apple',
                singularName: 'Apple',
                pluralName: 'Apples',
                unit: 'each',
              },
              {
                _id: 'f2',
                name: 'Banana',
                singularName: 'Banana',
                pluralName: 'Bananas',
                unit: 'each',
              },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  function getItemNameInput() {
    return screen.getByRole('combobox', { name: /item name/i });
  }

  it('shows "Add as a Food Item" option when input has no exact matches', async () => {
    const user = userEvent.setup();
    render(<ItemEditorDialog {...defaultProps} />);
    const input = getItemNameInput();
    await user.type(input, 'Zucchini');
    await waitFor(
      () => {
        expect(
          screen.getByRole('button', {
            name: /add "zucchini" as a food item/i,
          })
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('shows matching results from server-side search', async () => {
    const user = userEvent.setup();
    render(<ItemEditorDialog {...defaultProps} />);
    const input = getItemNameInput();
    await user.type(input, 'App');
    await waitFor(
      () => {
        expect(screen.getByText('Apple')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('shows "Add as a Food Item" alongside matching results', async () => {
    const user = userEvent.setup();
    render(<ItemEditorDialog {...defaultProps} />);
    const input = getItemNameInput();
    await user.type(input, 'App');
    await waitFor(
      () => {
        expect(screen.getByText('Apple')).toBeInTheDocument();
        expect(
          screen.getByRole('button', {
            name: /add "app" as a food item/i,
          })
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });
});
