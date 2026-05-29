import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MealPlanCreateDialogProps } from '../MealPlanCreateDialog';
import MealPlanCreateDialog from '../MealPlanCreateDialog';

afterEach(cleanup);

// The component provides its own LocalizationProvider wrapping the DatePicker,
// so no external wrapper is needed.

function renderDialog(overrides: Partial<MealPlanCreateDialogProps> = {}) {
  const defaults: MealPlanCreateDialogProps = {
    open: true,
    onClose: () => {},
    mealPlanOwners: [],
    selectedOwner: null,
    onSelectedOwnerChange: () => {},
    currentUserId: 'user-1',
    newMealPlan: { startDate: '' },
    onNewMealPlanChange: () => {},
    validationError: null,
    skippedDefault: null,
    template: null,
    onSubmit: () => {},
    ...overrides,
  };
  return render(<MealPlanCreateDialog {...defaults} />);
}

describe('MealPlanCreateDialog', () => {
  it('renders the dialog title and the start-date picker; Create plan button is disabled when no date is set', () => {
    renderDialog();
    expect(screen.getByText('New meal plan')).toBeInTheDocument();
    // Start Date label is visible
    expect(screen.getByText(/start date/i)).toBeInTheDocument();
    // Create button is disabled while startDate is empty
    const createBtn = screen.getByRole('button', { name: /create plan/i });
    expect(createBtn).toBeInTheDocument();
    expect(createBtn).toBeDisabled();
  });

  it('shows the alert box with the validation error message when validationError is set', () => {
    renderDialog({ validationError: 'Start date is required' });
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Start date is required');
  });

  it('renders the skip warning when skippedDefault.skipped is true', () => {
    renderDialog({
      skippedDefault: {
        skipped: true,
        skippedFrom: '2024-01-01',
        earliestAvailable: '2024-01-08',
      },
    });
    expect(screen.getByText(/The earliest available start date/i)).toBeInTheDocument();
    expect(screen.getByText('2024-01-08')).toBeInTheDocument();
  });
});
