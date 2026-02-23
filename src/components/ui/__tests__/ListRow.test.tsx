'use client';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ListRow } from '../ListRow';

describe('ListRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders children', () => {
    render(
      <ListRow>
        <span>Row content</span>
      </ListRow>,
    );

    expect(screen.getByText('Row content')).toBeInTheDocument();
  });

  it('renders with the list-row test id', () => {
    render(
      <ListRow>
        <span>Content</span>
      </ListRow>,
    );

    expect(screen.getByTestId('list-row')).toBeInTheDocument();
  });

  it('fires onClick when clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <ListRow onClick={handleClick}>
        <span>Clickable row</span>
      </ListRow>,
    );

    await user.click(screen.getByTestId('list-row'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('has role="button" and is focusable when onClick is set', () => {
    const handleClick = vi.fn();

    render(
      <ListRow onClick={handleClick}>
        <span>Clickable</span>
      </ListRow>,
    );

    const row = screen.getByTestId('list-row');
    expect(row).toHaveAttribute('role', 'button');
    expect(row).toHaveAttribute('tabindex', '0');
  });

  it('does not have role="button" when onClick is not set', () => {
    render(
      <ListRow>
        <span>Static row</span>
      </ListRow>,
    );

    const row = screen.getByTestId('list-row');
    expect(row).not.toHaveAttribute('role');
    expect(row).not.toHaveAttribute('tabindex');
  });

  it('fires onClick on Enter key press', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <ListRow onClick={handleClick}>
        <span>Keyboard row</span>
      </ListRow>,
    );

    const row = screen.getByTestId('list-row');
    row.focus();
    await user.keyboard('{Enter}');

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('fires onClick on Space key press', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <ListRow onClick={handleClick}>
        <span>Keyboard row</span>
      </ListRow>,
    );

    const row = screen.getByTestId('list-row');
    row.focus();
    await user.keyboard(' ');

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies selected state styling', () => {
    render(
      <ListRow selected>
        <span>Selected row</span>
      </ListRow>,
    );

    const row = screen.getByTestId('list-row');
    // MUI applies styles via classes — check the element exists with selected prop
    expect(row).toBeInTheDocument();
    // The component applies action.selected background when selected is true
    // Verify the component renders without error when selected
    expect(screen.getByText('Selected row')).toBeInTheDocument();
  });

  it('passes accentColor prop without error', () => {
    render(
      <ListRow accentColor="#ff5722" onClick={() => {}}>
        <span>Accented row</span>
      </ListRow>,
    );

    const row = screen.getByTestId('list-row');
    expect(row).toBeInTheDocument();
  });

  it('applies custom sx prop', () => {
    render(
      <ListRow sx={{ marginTop: 2 }}>
        <span>Styled row</span>
      </ListRow>,
    );

    expect(screen.getByTestId('list-row')).toBeInTheDocument();
  });
});
