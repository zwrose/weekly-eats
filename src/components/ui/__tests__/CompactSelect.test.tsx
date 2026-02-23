'use client';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MenuItem } from '@mui/material';
import { CompactSelect } from '../CompactSelect';

describe('CompactSelect', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    children: [
      <MenuItem key="a" value="apple">Apple</MenuItem>,
      <MenuItem key="b" value="banana">Banana</MenuItem>,
      <MenuItem key="c" value="cherry">Cherry</MenuItem>,
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders label above select when label is provided', () => {
    render(<CompactSelect {...defaultProps} label="Fruit" />);

    const label = screen.getByText('Fruit');
    expect(label).toBeInTheDocument();

    // The select combobox should also be present
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();

    // Label should appear before (above) the select in the DOM
    const container = label.closest('[data-testid="compact-select-root"]');
    expect(container).toBeInTheDocument();
  });

  it('renders without label when label is not provided', () => {
    render(<CompactSelect {...defaultProps} />);

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();

    const root = select.closest('[data-testid="compact-select-root"]');
    expect(root).toBeInTheDocument();
    expect(root!.querySelector('[data-testid="compact-select-label"]')).not.toBeInTheDocument();
  });

  it('calls onChange when an option is selected', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<CompactSelect {...defaultProps} onChange={handleChange} />);

    // Open the select dropdown
    const select = screen.getByRole('combobox');
    await user.click(select);

    // Click on an option in the listbox
    const listbox = within(screen.getByRole('listbox'));
    await user.click(listbox.getByText('Banana'));

    expect(handleChange).toHaveBeenCalled();
  });

  it('displays the selected value', () => {
    render(<CompactSelect {...defaultProps} value="apple" />);

    // MUI Select renders the selected value text
    expect(screen.getByText('Apple')).toBeInTheDocument();
  });

  it('renders with displayEmpty', () => {
    render(
      <CompactSelect
        {...defaultProps}
        value=""
        displayEmpty
        renderValue={(value: string) => (value ? value : 'Select a fruit')}
      />,
    );

    expect(screen.getByText('Select a fruit')).toBeInTheDocument();
  });

  it('renders as fullWidth when specified', () => {
    render(
      <CompactSelect {...defaultProps} label="Category" fullWidth />,
    );

    const root = screen.getByTestId('compact-select-root');
    expect(root).toBeInTheDocument();
  });
});
