import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PresencePill } from '../PresencePill';
import { renderWithTheme } from '@/test-utils/renderWithTheme';

describe('PresencePill', () => {
  it('shows LIVE when connected and alone', () => {
    renderWithTheme(
      <PresencePill connectionState="connected" activeUsers={[]} onReconnect={() => {}} />
    );
    expect(screen.getByText(/live/i)).toBeInTheDocument();
  });
  it('shows one avatar when one other user is present', () => {
    renderWithTheme(
      <PresencePill
        connectionState="connected"
        activeUsers={[{ name: 'Sara Rose', email: 'sara@x.com' }]}
        onReconnect={() => {}}
      />
    );
    expect(screen.getByLabelText('Sara Rose')).toBeInTheDocument();
  });
  it('caps avatars at 3 and shows +N for the rest', () => {
    const users = ['A A', 'B B', 'C C', 'D D', 'E E'].map((n, i) => ({
      name: n,
      email: `${i}@x.com`,
    }));
    renderWithTheme(
      <PresencePill connectionState="connected" activeUsers={users} onReconnect={() => {}} />
    );
    expect(screen.getByText('+2')).toBeInTheDocument();
  });
  it('shows CONNECTING while connecting', () => {
    renderWithTheme(
      <PresencePill connectionState="connecting" activeUsers={[]} onReconnect={() => {}} />
    );
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });
  it('is an actionable reconnect control when offline', async () => {
    const user = userEvent.setup();
    const onReconnect = vi.fn();
    renderWithTheme(
      <PresencePill connectionState="suspended" activeUsers={[]} onReconnect={onReconnect} />
    );
    await user.click(screen.getByText(/offline/i));
    expect(onReconnect).toHaveBeenCalled();
  });
  it('offers Retry on failure', () => {
    renderWithTheme(
      <PresencePill connectionState="failed" activeUsers={[]} onReconnect={() => {}} />
    );
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
