// src/components/recipes/__tests__/Stars.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Stars } from '../Stars';

afterEach(cleanup);

describe('Stars', () => {
  it('renders five stars in view mode (no buttons)', () => {
    render(<Stars rating={3} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    // five glyphs present
    expect(screen.getAllByText('★')).toHaveLength(5);
  });

  it('editable: clicking a star sets that rating', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Stars rating={0} editable onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: '4 stars' }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('editable: clicking the current rating clears it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Stars rating={3} editable onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: '3 stars' }));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('shows a shared-ratings summary in view mode when provided', () => {
    render(
      <Stars
        rating={5}
        sharedRatings={[{ userId: 'u', userEmail: 'a@b.com', userName: 'Avery', rating: 4 }]}
      />
    );
    expect(screen.getByText(/Avery/)).toBeInTheDocument();
  });
});
