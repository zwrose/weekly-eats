import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { FinishShopConfirm } from '../FinishShopConfirm';
import { renderWithTheme } from '@/test-utils/renderWithTheme';

describe('FinishShopConfirm', () => {
  it('confirms the trip', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderWithTheme(
      <FinishShopConfirm
        open
        variant="dialog"
        storeName="Corner market"
        boughtCount={3}
        remainingCount={2}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    );
    expect(screen.getByText('Finish this shop?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save trip/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
