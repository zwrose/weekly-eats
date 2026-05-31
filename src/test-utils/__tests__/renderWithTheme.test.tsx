import { screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useTheme } from '@mui/material/styles';
import { renderWithTheme } from '../renderWithTheme';
import { tokens } from '@/lib/design-tokens';

function Probe() {
  const t = useTheme();
  return <span data-testid="primary">{t.palette.primary.main}</span>;
}

describe('renderWithTheme', () => {
  it('binds the shop section accent to palette.primary by default', () => {
    renderWithTheme(<Probe />);
    expect(screen.getByTestId('primary')).toHaveTextContent(tokens.section.shop);
  });

  it('binds the pantry section accent when section="pantry"', () => {
    renderWithTheme(<Probe />, { section: 'pantry' });
    expect(screen.getByTestId('primary')).toHaveTextContent(tokens.section.pantry);
  });
});
