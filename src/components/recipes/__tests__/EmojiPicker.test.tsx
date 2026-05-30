import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmojiPicker } from '../EmojiPicker';

afterEach(cleanup);

describe('EmojiPicker (recipes)', () => {
  it('does not render content when closed', () => {
    render(<EmojiPicker open={false} onClose={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.queryByPlaceholderText(/search emoji/i)).not.toBeInTheDocument();
  });

  it('selecting an emoji fires onSelect + onClose', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<EmojiPicker open onSelect={onSelect} onClose={onClose} currentEmoji="🍝" />);
    // 🍝 is in FOOD_EMOJIS; click the first emoji button
    const buttons = screen.getAllByRole('button', { name: /emoji /i });
    await user.click(buttons[0]);
    expect(onSelect).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('Clear emits an empty selection', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<EmojiPicker open onSelect={onSelect} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /^clear$/i }));
    expect(onSelect).toHaveBeenCalledWith('');
  });
});
