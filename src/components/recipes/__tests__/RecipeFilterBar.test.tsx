import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeFilterBar } from '../RecipeFilterBar';

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
});

const baseProps = {
  searchTerm: '',
  onSearchChange: vi.fn(),
  selectedTags: [] as string[],
  onTagsChange: vi.fn(),
  availableTags: ['italian', 'quick'],
  selectedRatings: [] as number[],
  onRatingsChange: vi.fn(),
  sortBy: 'updatedAt',
  sortOrder: 'desc' as const,
  onSortChange: vi.fn(),
  hasActiveFilters: false,
  onClearFilters: vi.fn(),
};

describe('RecipeFilterBar', () => {
  it('typing in search emits onSearchChange', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(<RecipeFilterBar {...baseProps} onSearchChange={onSearchChange} />);
    await user.type(screen.getByPlaceholderText(/search recipes/i), 'pasta');
    expect(onSearchChange).toHaveBeenCalled();
  });

  it('opening the Tags menu and selecting a tag emits onTagsChange', async () => {
    const user = userEvent.setup();
    const onTagsChange = vi.fn();
    render(<RecipeFilterBar {...baseProps} onTagsChange={onTagsChange} />);
    await user.click(screen.getByRole('button', { name: /tags/i }));
    await user.click(screen.getByRole('button', { name: 'italian' }));
    expect(onTagsChange).toHaveBeenCalledWith(['italian']);
  });

  it('shows Clear when filters are active and emits onClearFilters', async () => {
    const user = userEvent.setup();
    const onClearFilters = vi.fn();
    render(<RecipeFilterBar {...baseProps} hasActiveFilters onClearFilters={onClearFilters} />);
    await user.click(screen.getByRole('button', { name: /clear/i }));
    expect(onClearFilters).toHaveBeenCalled();
  });

  it('clicking the active sort key flips the sort direction', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    // Active sort is updatedAt/desc — clicking "Updated" again should flip to asc
    render(
      <RecipeFilterBar
        {...baseProps}
        sortBy="updatedAt"
        sortOrder="desc"
        onSortChange={onSortChange}
      />
    );
    await user.click(screen.getByRole('button', { name: /sort/i }));
    await user.click(screen.getByRole('menuitem', { name: /updated/i }));
    expect(onSortChange).toHaveBeenCalledWith('updatedAt', 'asc');
  });

  it('clicking a different sort key uses its default direction', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    // Active sort is updatedAt — clicking Title should use default asc
    render(
      <RecipeFilterBar
        {...baseProps}
        sortBy="updatedAt"
        sortOrder="desc"
        onSortChange={onSortChange}
      />
    );
    await user.click(screen.getByRole('button', { name: /sort/i }));
    await user.click(screen.getByRole('menuitem', { name: /title/i }));
    expect(onSortChange).toHaveBeenCalledWith('title', 'asc');
  });
});
