// src/components/recipes/__tests__/RecipeTagsEditor.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeTagsEditor } from '../RecipeTagsEditor';

afterEach(cleanup);

describe('RecipeTagsEditor', () => {
  it('renders existing tags with remove controls', () => {
    render(<RecipeTagsEditor value={['italian', 'quick']} onChange={vi.fn()} />);
    expect(screen.getByText('italian')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove italian' })).toBeInTheDocument();
  });

  it('removing a tag emits the remaining tags', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RecipeTagsEditor value={['italian', 'quick']} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Remove italian' }));
    expect(onChange).toHaveBeenCalledWith(['quick']);
  });

  it('adds a new tag on Enter and ignores duplicates/blanks', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RecipeTagsEditor value={['italian']} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /add tag/i }));
    const input = screen.getByPlaceholderText(/add a tag/i);
    await user.type(input, 'vegan{Enter}');
    expect(onChange).toHaveBeenCalledWith(['italian', 'vegan']);
    onChange.mockClear();
    await user.type(input, 'italian{Enter}'); // duplicate
    await user.type(input, '   {Enter}'); // blank
    expect(onChange).not.toHaveBeenCalled();
  });
});
