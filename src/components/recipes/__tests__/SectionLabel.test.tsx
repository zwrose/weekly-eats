// src/components/recipes/__tests__/SectionLabel.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SectionLabel } from '../SectionLabel';

afterEach(cleanup);

describe('SectionLabel', () => {
  it('renders the label text', () => {
    render(<SectionLabel>Ingredients</SectionLabel>);
    expect(screen.getByText('Ingredients')).toBeInTheDocument();
  });

  it('renders the optional right slot when provided', () => {
    render(<SectionLabel right={<button>+ Group</button>}>Ingredients</SectionLabel>);
    expect(screen.getByRole('button', { name: '+ Group' })).toBeInTheDocument();
  });

  it('omits the right slot when not provided', () => {
    render(<SectionLabel>Instructions</SectionLabel>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
