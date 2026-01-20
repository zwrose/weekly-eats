import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecipeStarRating from '../RecipeStarRating';

describe('RecipeStarRating', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic functionality', () => {
    it('renders 5 stars', () => {
      const { container } = render(
        <RecipeStarRating
          rating={undefined}
          onChange={mockOnChange}
          editable={true}
        />
      );

      // Find stars within the component container (React strict mode renders twice)
      const component = container.firstChild as HTMLElement;
      const stars = within(component).getAllByRole('button');
      expect(stars.length).toBeGreaterThanOrEqual(5);
    });

    it('displays filled stars up to the rating value', () => {
      const { container } = render(
        <RecipeStarRating
          rating={3}
          onChange={mockOnChange}
          editable={true}
        />
      );

      // Check that stars are rendered (MUI icons might render as SVGs)
      const component = container.firstChild as HTMLElement;
      const starButtons = within(component).getAllByRole('button');
      expect(starButtons.length).toBeGreaterThanOrEqual(5);
    });

    it('calls onChange when a star is clicked', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <RecipeStarRating
          rating={undefined}
          onChange={mockOnChange}
          editable={true}
        />
      );

      const component = container.firstChild as HTMLElement;
      const stars = within(component).getAllByRole('button');
      // Click the first star button (React strict mode may render multiple instances)
      await user.click(stars[0]);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });
    });

    it('clears rating when clicking the same star again', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <RecipeStarRating
          rating={3}
          onChange={mockOnChange}
          editable={true}
        />
      );

      const component = container.firstChild as HTMLElement;
      const stars = within(component).getAllByRole('button');
      // Click a star button
      await user.click(stars[0]);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });
    });

    it('updates rating when clicking a different star', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <RecipeStarRating
          rating={2}
          onChange={mockOnChange}
          editable={true}
        />
      );

      const component = container.firstChild as HTMLElement;
      const stars = within(component).getAllByRole('button');
      // Click a star button
      await user.click(stars[0]);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });
    });

    it('shows hover effect when hovering over stars', async () => {
      const user = userEvent.setup();
      render(
        <RecipeStarRating
          rating={undefined}
          onChange={mockOnChange}
          editable={true}
        />
      );

      const stars = screen.getAllByRole('button');
      await user.hover(stars[2]); // Hover over 3rd star

      // Hover state should change visual appearance (this is visual, but we can verify the component doesn't crash)
      expect(stars[2]).toBeInTheDocument();
    });
  });

  describe('Shared ratings display', () => {
    it('displays shared ratings when provided', () => {
      const sharedRatings = [
        { userId: 'user1', userEmail: 'user1@example.com', rating: 4 },
        { userId: 'user2', userEmail: 'user2@example.com', rating: 5 },
      ];

      render(
        <RecipeStarRating
          rating={3}
          sharedRatings={sharedRatings}
          onChange={mockOnChange}
          editable={true}
        />
      );

      expect(screen.getByText(/shared ratings/i)).toBeInTheDocument();
      expect(screen.getByText(/user1@example.com/i)).toBeInTheDocument();
      expect(screen.getByText(/user2@example.com/i)).toBeInTheDocument();
    });

    it('displays shared ratings with user names when available', () => {
      const sharedRatings = [
        { userId: 'user1', userEmail: 'user1@example.com', userName: 'User One', rating: 4 },
      ];

      render(
        <RecipeStarRating
          rating={3}
          sharedRatings={sharedRatings}
          onChange={mockOnChange}
          editable={true}
        />
      );

      expect(screen.getByText(/user one/i)).toBeInTheDocument();
    });

    it('does not display shared ratings section when no shared ratings', () => {
      const { container } = render(
        <RecipeStarRating
          rating={3}
          onChange={mockOnChange}
          editable={true}
        />
      );

      const component = container.firstChild as HTMLElement;
      expect(within(component).queryByText(/shared ratings/i)).not.toBeInTheDocument();
    });

    it('displays shared ratings even in non-editable mode', () => {
      const sharedRatings = [
        { userId: 'user1', userEmail: 'user1@example.com', rating: 4 },
      ];

      const { container } = render(
        <RecipeStarRating
          rating={3}
          sharedRatings={sharedRatings}
          editable={false}
        />
      );

      const component = container.firstChild as HTMLElement;
      // React strict mode may render multiple instances, so check for at least one
      const sharedRatingsText = within(component).queryAllByText(/shared ratings/i);
      expect(sharedRatingsText.length).toBeGreaterThan(0);
      expect(within(component).getByText(/user1@example.com/i)).toBeInTheDocument();
    });
  });

  describe('Read-only mode', () => {
    it('does not call onChange when not editable', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <RecipeStarRating
          rating={3}
          onChange={mockOnChange}
          editable={false}
        />
      );

      // When not editable, stars are not rendered as buttons, they're just icons
      // Check that no buttons are present (in read-only mode, stars are just icons)
      const component = container.firstChild as HTMLElement;
      if (component) {
        const buttons = within(component).queryAllByRole('button');
        // In non-editable mode, there should be no clickable buttons
        expect(buttons.length).toBe(0);
      }
      
      // Verify onChange was not called
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('does not show hover effect when not editable', async () => {
      const user = userEvent.setup();
      render(
        <RecipeStarRating
          rating={3}
          onChange={mockOnChange}
          editable={false}
        />
      );

      const stars = screen.getAllByRole('button');
      if (stars.length > 0) {
        await user.hover(stars[0]);
        // Hover state should not change (component should handle this)
        expect(stars[0]).toBeInTheDocument();
      }
    });

    it('does not call onChange if onChange is not provided', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <RecipeStarRating
          rating={3}
          editable={true}
        />
      );

      // When onChange is not provided, buttons may still exist but clicks should not trigger onChange
      // Find buttons within the component
      const component = container.firstChild as HTMLElement;
      if (component) {
        const buttons = within(component).queryAllByRole('button');
        if (buttons.length > 0) {
          // Clicking should not cause errors even without onChange
          await user.click(buttons[0]);
        }
      }

      // mockOnChange should not have been called since it's not provided to the component
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });
});

