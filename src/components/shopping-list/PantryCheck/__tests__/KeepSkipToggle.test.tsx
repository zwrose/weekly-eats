import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { KeepSkipToggle } from '../KeepSkipToggle';

describe('KeepSkipToggle', () => {
  it('marks the active half via aria-pressed', () => {
    render(<KeepSkipToggle value="keep" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /keep/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /skip/i })).toHaveAttribute('aria-pressed', 'false');
  });
  it('calls onChange with the other value when the inactive half is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeepSkipToggle value="keep" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /skip/i }));
    expect(onChange).toHaveBeenCalledWith('skip');
  });
});
