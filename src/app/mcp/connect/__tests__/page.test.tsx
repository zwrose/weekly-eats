import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { signIn, peekAuthState, getClient } = vi.hoisted(() => ({
  signIn: vi.fn(),
  peekAuthState: vi.fn(),
  getClient: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ signIn }));
vi.mock('@/lib/mcp/oauth/stores/auth-states', () => ({ peekAuthState }));
vi.mock('@/lib/mcp/oauth/stores/clients', () => ({ getClient }));

import ConnectPage from '../page';

beforeEach(() => {
  signIn.mockReset();
  peekAuthState.mockReset().mockResolvedValue({
    clientId: 'c1',
    redirectUri: 'https://claude.ai/cb',
    scope: 'weekly-eats:rw',
    clientState: 'xyz',
    codeChallenge: 'chal',
    resource: 'https://app.test/api/mcp',
    expiresAt: 9_999_999_999_999,
  });
  getClient
    .mockReset()
    .mockResolvedValue({ clientId: 'c1', clientName: 'Claude', redirectUris: [] });
});

describe('connect page', () => {
  it('renders the client name and a Google sign-in form carrying the nonce', async () => {
    const ui = await ConnectPage({ searchParams: Promise.resolve({ mcp_auth: 'raw-nonce' }) });
    render(ui);
    expect(screen.getByText(/Connect Claude to Weekly Eats/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
    // the form carries the single-use nonce so the action can rebuild the continuation
    const hidden = document.querySelectorAll('input[name="mcp_auth"][value="raw-nonce"]');
    expect(hidden.length).toBe(1);
  });

  it('falls back to a generic title when the registered client has no name', async () => {
    getClient.mockResolvedValue({ clientId: 'c1', redirectUris: [] });
    const ui = await ConnectPage({ searchParams: Promise.resolve({ mcp_auth: 'raw-nonce' }) });
    render(ui);
    expect(screen.getByText('Connect to Weekly Eats')).toBeInTheDocument();
  });

  it('shows a friendly expired message (no sign-in button) when the pending request is gone', async () => {
    peekAuthState.mockResolvedValue(null);
    const ui = await ConnectPage({ searchParams: Promise.resolve({ mcp_auth: 'bad' }) });
    render(ui);
    expect(screen.getByRole('heading', { name: /expired/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in with google/i })).not.toBeInTheDocument();
    // short-circuits before looking up the client
    expect(getClient).not.toHaveBeenCalled();
  });
});
