import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecipeFilterBar from '../RecipeFilterBar';

const defaultProps = {
  searchTerm: '',
  onSearchChange: vi.fn(),
  accessLevel: 'all' as const,
  onAccessLevelChange: vi.fn(),
  selectedTags: [] as string[],
  onTagsChange: vi.fn(),
  availableTags: ['italian', 'quick', 'healthy', 'dinner'],
  minRating: null as number | null,
  onMinRatingChange: vi.fn(),
  sortBy: 'updatedAt',
  sortOrder: 'desc' as const,
  onSortChange: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RecipeFilterBar', () => {
  it('renders search input', () => {
    render(<RecipeFilterBar {...defaultProps} />);
    expect(screen.getByPlaceholderText(/search recipes/i)).toBeInTheDocument();
  });

  it('calls onSearchChange when typing in search', async () => {
    const user = userEvent.setup();
    render(<RecipeFilterBar {...defaultProps} />);
    const input = screen.getByPlaceholderText(/search recipes/i);
    await user.type(input, 'pizza');
    expect(defaultProps.onSearchChange).toHaveBeenCalled();
  });

  it('renders access level selector', () => {
    render(<RecipeFilterBar {...defaultProps} />);
    expect(screen.getByLabelText(/access level/i)).toBeInTheDocument();
  });

  it('renders sort selector', () => {
    render(<RecipeFilterBar {...defaultProps} />);
    expect(screen.getByLabelText(/sort by/i)).toBeInTheDocument();
  });

  it('renders rating filter', () => {
    render(<RecipeFilterBar {...defaultProps} />);
    expect(screen.getByLabelText(/min rating/i)).toBeInTheDocument();
  });

  it('renders tag filter', () => {
    render(<RecipeFilterBar {...defaultProps} />);
    expect(screen.getByLabelText(/tags/i)).toBeInTheDocument();
  });

  it('displays selected tags as chips', () => {
    render(<RecipeFilterBar {...defaultProps} selectedTags={['italian', 'quick']} />);
    expect(screen.getByText('italian')).toBeInTheDocument();
    expect(screen.getByText('quick')).toBeInTheDocument();
  });

  it('shows current search value', () => {
    render(<RecipeFilterBar {...defaultProps} searchTerm="pasta" />);
    const input = screen.getByPlaceholderText(/search recipes/i);
    expect(input).toHaveValue('pasta');
  });
});
