// src/components/recipes/__tests__/RecipeInstructionsView.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { RecipeInstructionsView } from '../RecipeInstructionsView';

afterEach(cleanup);

describe('RecipeInstructionsView', () => {
  it('renders markdown headings, paragraphs, and lists', () => {
    render(
      <RecipeInstructionsView instructions={'# Step one\n\nBoil water.\n\n- salt\n- pasta'} />
    );
    expect(screen.getByText('Step one')).toBeInTheDocument();
    expect(screen.getByText('Boil water.')).toBeInTheDocument();
    expect(screen.getByText('salt')).toBeInTheDocument();
    expect(screen.getByText('pasta')).toBeInTheDocument();
  });

  it('renders nothing meaningful for empty instructions', () => {
    const { container } = render(<RecipeInstructionsView instructions="" />);
    expect(container).toBeTruthy();
  });
});
