import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import { renderWithTheme } from '@/test-utils/renderWithTheme';

describe('EmojiPicker (flat grid)', () => {
  afterEach(cleanup);

  it('does not render content when closed', () => {
    renderWithTheme(<EmojiPicker open={false} onClose={() => {}} onSelect={vi.fn()} />);
    expect(screen.queryByPlaceholderText(/search emoji/i)).not.toBeInTheDocument();
  });

  it('filters by search and selects an emoji', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onClose = vi.fn();
    renderWithTheme(<EmojiPicker open onClose={onClose} onSelect={onSelect} />);
    await user.type(screen.getByPlaceholderText(/search emoji/i), 'carrot');
    await user.click(screen.getByRole('button', { name: /carrot/i }));
    expect(onSelect).toHaveBeenCalledWith('🥕');
    expect(onClose).toHaveBeenCalled();
  });

  it('Clear emits an empty selection', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithTheme(<EmojiPicker open onClose={() => {}} onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: /^clear$/i }));
    expect(onSelect).toHaveBeenCalledWith('');
  });
});
