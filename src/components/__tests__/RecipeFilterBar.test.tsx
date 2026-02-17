import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecipeFilterBar from '../RecipeFilterBar';

const defaultProps = {
  searchTerm: '',
  onSearchChange: vi.fn(),
  selectedTags: [] as string[],
  onTagsChange: vi.fn(),
  availableTags: ['italian', 'quick', 'healthy', 'dinner'],
  selectedRatings: [] as number[],
  onRatingsChange: vi.fn(),
  sortBy: 'updatedAt',
  sortOrder: 'desc' as const,
  onSortChange: vi.fn(),
  hasActiveFilters: false,
  onClearFilters: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('RecipeFilterBar', () => {
  it('renders search input', () => {
    render(<RecipeFilterBar {...defaultProps} />);
    expect(screen.getAllByPlaceholderText(/search recipes/i).length).toBeGreaterThan(0);
  });

  it('calls onSearchChange when typing in search', async () => {
    const user = userEvent.setup();
    render(<RecipeFilterBar {...defaultProps} />);
    const inputs = screen.getAllByPlaceholderText(/search recipes/i);
    await user.type(inputs[0], 'pizza');
    expect(defaultProps.onSearchChange).toHaveBeenCalled();
  });

  it('shows current search value', () => {
    render(<RecipeFilterBar {...defaultProps} searchTerm="pasta" />);
    const inputs = screen.getAllByPlaceholderText(/search recipes/i);
    expect(inputs[0]).toHaveValue('pasta');
  });

  it('renders tag filter', () => {
    render(<RecipeFilterBar {...defaultProps} />);
    expect(screen.getAllByLabelText(/tags/i).length).toBeGreaterThan(0);
  });

  it('displays selected tags as chips', () => {
    render(<RecipeFilterBar {...defaultProps} selectedTags={['italian', 'quick']} />);
    // Tags appear in both desktop and mobile drawer filter controls
    expect(screen.getAllByText('italian').length).toBeGreaterThan(0);
    expect(screen.getAllByText('quick').length).toBeGreaterThan(0);
  });

  it('renders rating dropdown', () => {
    render(<RecipeFilterBar {...defaultProps} />);
    expect(screen.getAllByLabelText(/rating/i).length).toBeGreaterThan(0);
  });

  it('renders mobile filter button', () => {
    render(<RecipeFilterBar {...defaultProps} />);
    expect(screen.getByLabelText(/open filters/i)).toBeInTheDocument();
  });

  it('does not render access level selector', () => {
    render(<RecipeFilterBar {...defaultProps} />);
    expect(screen.queryByLabelText(/access level/i)).not.toBeInTheDocument();
  });

  it('shows clear filters button when filters are active', () => {
    render(<RecipeFilterBar {...defaultProps} hasActiveFilters={true} />);
    expect(screen.getAllByText(/clear filters/i).length).toBeGreaterThan(0);
  });

  it('hides clear filters button when no filters are active', () => {
    render(<RecipeFilterBar {...defaultProps} hasActiveFilters={false} />);
    expect(screen.queryByText(/clear filters/i)).not.toBeInTheDocument();
  });
});
