import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ShoppingItemRow } from '../ShoppingItemRow';
import { AddItemRow } from '../AddItemRow';
import { renderWithTheme } from '@/test-utils/renderWithTheme';

const item = { foodItemId: 'f1', name: 'shallots', quantity: 2, unit: 'each', checked: false };

describe('ShoppingItemRow', () => {
  it('renders name + quantity and an unchecked checkbox', () => {
    renderWithTheme(<ShoppingItemRow item={item} onToggle={() => {}} onEdit={() => {}} />);
    expect(screen.getByText('shallots')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /shallots/i })).not.toBeChecked();
  });
  it('calls onToggle when the checkbox is clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    renderWithTheme(<ShoppingItemRow item={item} onToggle={onToggle} onEdit={() => {}} />);
    await user.click(screen.getByRole('checkbox', { name: /shallots/i }));
    expect(onToggle).toHaveBeenCalledWith('f1');
  });
  it('reflects the checked state on the checkbox when checked', () => {
    renderWithTheme(
      <ShoppingItemRow item={{ ...item, checked: true }} onToggle={() => {}} onEdit={() => {}} />
    );
    expect(screen.getByRole('checkbox', { name: /shallots/i })).toBeChecked();
    expect(screen.getByText('shallots')).toHaveStyle({ textDecoration: 'line-through' });
  });
});

describe('AddItemRow', () => {
  it('renders the add-item label', () => {
    renderWithTheme(<AddItemRow onClick={() => {}} />);
    expect(screen.getByText('Add item')).toBeInTheDocument();
  });
  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderWithTheme(<AddItemRow onClick={onClick} />);
    await user.click(screen.getByRole('button', { name: /add item/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
