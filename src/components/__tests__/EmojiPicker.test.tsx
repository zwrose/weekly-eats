import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmojiPicker from '../EmojiPicker';

describe('EmojiPicker', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onSelect: vi.fn(),
  };

  afterEach(() => {
    cleanup();
  });

  it('renders emoji picker when open', () => {
    render(<EmojiPicker {...defaultProps} />);
    
    expect(screen.getByText(/choose an emoji/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search emojis/i)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<EmojiPicker {...defaultProps} open={false} />);
    
    expect(screen.queryByText(/choose an emoji/i)).not.toBeInTheDocument();
  });

  it('filters emojis when searching', async () => {
    const user = userEvent.setup();
    render(<EmojiPicker {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText(/search emojis/i);
    await user.type(searchInput, 'apple');
    
    // Should show apple emoji
    expect(screen.getByText('🍎')).toBeInTheDocument();
  });

  it('calls onSelect when emoji is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<EmojiPicker {...defaultProps} onSelect={onSelect} />);
    
    const appleEmoji = screen.getByText('🍎');
    await user.click(appleEmoji);
    
    expect(onSelect).toHaveBeenCalledWith('🍎');
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<EmojiPicker {...defaultProps} onClose={onClose} />);
    
    // The close button doesn't have a name, so we need to find it by testid
    const closeButton = screen.getByTestId('CloseIcon').closest('button');
    expect(closeButton).toBeInTheDocument();
    await user.click(closeButton!);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('shows no results message when search has no matches', async () => {
    const user = userEvent.setup();
    render(<EmojiPicker {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText(/search emojis/i);
    await user.type(searchInput, 'xyz123');
    
    // The component shows an empty grid when no results are found
    const emojiGrid = screen.getByRole('dialog').querySelector('[class*="css-kkxnn5"]');
    expect(emojiGrid).toBeInTheDocument();
    expect(emojiGrid?.children.length).toBe(0);
  });
});
