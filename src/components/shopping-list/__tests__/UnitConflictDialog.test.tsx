import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { UnitConflictDialog, type UnitConflictView } from '../UnitConflictDialog';
import { renderWithTheme } from '@/test-utils/renderWithTheme';

const CONFLICT: UnitConflictView = {
  foodItemId: 'fi-1',
  foodItemName: 'Flour',
  isAutoConverted: true,
  suggestedQuantity: 3,
  suggestedUnit: 'cup',
  unitBreakdown: [
    { quantity: 1, unit: 'cup' },
    { quantity: 2, unit: 'cup' },
  ],
};

function baseProps() {
  return {
    open: true,
    conflict: CONFLICT,
    index: 0,
    total: 3,
    quantity: 3,
    unit: 'cup',
    resolved: true,
    isLast: false,
    onQuantityChange: vi.fn(),
    onUnitChange: vi.fn(),
    onPrevious: vi.fn(),
    onNext: vi.fn(),
  };
}

describe('UnitConflictDialog', () => {
  it('renders the conflict index and food item name', () => {
    renderWithTheme(<UnitConflictDialog {...baseProps()} />);
    expect(screen.getByText(/1 of 3/i)).toBeInTheDocument();
    expect(screen.getByText('Flour')).toBeInTheDocument();
  });

  it('fires onNext / onPrevious from the stepper controls', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    renderWithTheme(<UnitConflictDialog {...props} index={1} />);

    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(props.onPrevious).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /next conflict/i }));
    expect(props.onNext).toHaveBeenCalled();
  });

  it('shows Complete on the last conflict and disables Back at index 0', () => {
    renderWithTheme(<UnitConflictDialog {...baseProps()} index={0} isLast />);
    expect(screen.getByRole('button', { name: /complete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back/i })).toBeDisabled();
  });

  it('disables Next when the conflict is unresolved', () => {
    renderWithTheme(<UnitConflictDialog {...baseProps()} resolved={false} />);
    expect(screen.getByRole('button', { name: /next conflict/i })).toBeDisabled();
  });
});
