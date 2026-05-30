// src/components/recipes/__tests__/TagChip.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TagChip, AccessChip } from '../TagChip';

afterEach(cleanup);

describe('TagChip / AccessChip', () => {
  it('renders a tag label', () => {
    render(<TagChip>weeknight</TagChip>);
    expect(screen.getByText('weeknight')).toBeInTheDocument();
  });

  it('renders the access label for each level', () => {
    const { rerender } = render(<AccessChip access="private" />);
    expect(screen.getByText('Private')).toBeInTheDocument();
    rerender(<AccessChip access="shared-by-you" />);
    expect(screen.getByText('Shared by you')).toBeInTheDocument();
    rerender(<AccessChip access="shared-by-others" />);
    expect(screen.getByText('Shared by others')).toBeInTheDocument();
  });
});
