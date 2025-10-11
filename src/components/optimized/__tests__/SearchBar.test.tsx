import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchBar from '../SearchBar';

describe('SearchBar', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders and calls onChange as user types', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const { unmount } = render(<SearchBar value="" onChange={handleChange} />);
    const input = screen.getByPlaceholderText('Start typing to search...');
    await user.type(input, 'rice');
    expect(handleChange).toHaveBeenCalled();
    unmount();
  });
});


