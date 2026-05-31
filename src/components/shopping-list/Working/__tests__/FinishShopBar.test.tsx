import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { FinishShopBar } from '../FinishShopBar';
import { renderWithTheme } from '@/test-utils/renderWithTheme';

describe('FinishShopBar', () => {
  it('renders nothing when no items are in the cart', () => {
    const { container } = renderWithTheme(<FinishShopBar boughtCount={0} onFinish={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('shows the bought count and calls onFinish when clicked', async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    renderWithTheme(<FinishShopBar boughtCount={3} onFinish={onFinish} />);
    const btn = screen.getByRole('button', { name: /finish shop · 3 bought/i });
    await user.click(btn);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
