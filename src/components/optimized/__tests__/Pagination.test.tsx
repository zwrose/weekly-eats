import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Pagination from '../Pagination';

describe('Pagination', () => {
  it('hides when count <= 1', () => {
    const onChange = vi.fn();
    const { container } = render(<Pagination count={1} page={1} onChange={onChange} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls onChange when page is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Pagination count={3} page={1} onChange={onChange} />);
    const nextButton = screen.getByRole('button', { name: /go to page 2/i });
    await user.click(nextButton);
    expect(onChange).toHaveBeenCalledWith(2);
  });
});


