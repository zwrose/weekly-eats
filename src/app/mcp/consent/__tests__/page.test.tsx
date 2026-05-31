import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { auth, peekAuthState, getClient, redirect } = vi.hoisted(() => ({
  auth: vi.fn(),
  peekAuthState: vi.fn(),
  getClient: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock('@/lib/auth', () => ({ auth }));
vi.mock('@/lib/mcp/oauth/stores/auth-states', () => ({ peekAuthState }));
vi.mock('@/lib/mcp/oauth/stores/clients', () => ({ getClient }));
vi.mock('next/navigation', () => ({ redirect }));

import ConsentPage from '../page';

beforeEach(() => {
  auth.mockReset().mockResolvedValue({ user: { id: 'u1', name: 'Zach' } });
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

describe('consent page', () => {
  it('renders the client name and Allow/Deny forms carrying the nonce', async () => {
    const ui = await ConsentPage({ searchParams: Promise.resolve({ mcp_auth: 'raw-nonce' }) });
    render(ui);
    expect(screen.getByText(/Claude/)).toBeInTheDocument();
    const allow = screen.getByRole('button', { name: /allow/i });
    const deny = screen.getByRole('button', { name: /deny/i });
    expect(allow).toBeInTheDocument();
    expect(deny).toBeInTheDocument();
    // both forms POST to the decision endpoint with a hidden mcp_auth + decision
    const hidden = document.querySelectorAll('input[name="mcp_auth"][value="raw-nonce"]');
    expect(hidden.length).toBe(2);
    const forms = document.querySelectorAll('form[action="/api/mcp/oauth/authorize/decision"]');
    expect(forms.length).toBe(2);
  });

  it('redirects home when the pending request is missing/expired', async () => {
    peekAuthState.mockResolvedValue(null);
    await expect(
      ConsentPage({ searchParams: Promise.resolve({ mcp_auth: 'bad' }) })
    ).rejects.toThrow(/REDIRECT:\//);
  });

  it('redirects home when there is no session', async () => {
    auth.mockResolvedValue(null);
    await expect(
      ConsentPage({ searchParams: Promise.resolve({ mcp_auth: 'raw-nonce' }) })
    ).rejects.toThrow(/REDIRECT:/);
  });
});
