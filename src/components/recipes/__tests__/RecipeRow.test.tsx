// src/components/recipes/__tests__/RecipeRow.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeCardMobile, RecipeTableRow } from '../RecipeRow';

afterEach(cleanup);

const recipe = { _id: 'r1', title: 'Lemon pasta', emoji: '🍝', updatedAt: '2026-05-04T00:00:00Z' };

describe('RecipeRow atoms', () => {
  it('RecipeCardMobile renders title + tags and opens on click', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<RecipeCardMobile recipe={recipe} tags={['italian']} rating={5} onOpen={onOpen} />);
    expect(screen.getByText('Lemon pasta')).toBeInTheDocument();
    expect(screen.getByText('italian')).toBeInTheDocument();
    await user.click(screen.getByText('Lemon pasta'));
    expect(onOpen).toHaveBeenCalled();
  });

  it('RecipeTableRow renders title and opens on click', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<RecipeTableRow recipe={recipe} tags={['a', 'b', 'c']} rating={4} onOpen={onOpen} />);
    await user.click(screen.getByText('Lemon pasta'));
    expect(onOpen).toHaveBeenCalled();
  });
});
