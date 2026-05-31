import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getClient, revokeByHash } = vi.hoisted(() => ({
  getClient: vi.fn(),
  revokeByHash: vi.fn(),
}));

vi.mock('@/lib/mcp/oauth/stores/clients', () => ({ getClient }));
vi.mock('@/lib/mcp/oauth/stores/tokens', () => ({ revokeByHash }));

import { POST } from '../route';

function revokeReq(body: Record<string, string>) {
  return new Request('https://app.test/api/mcp/oauth/revoke', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
}

beforeEach(() => {
  getClient.mockReset().mockResolvedValue({ clientId: 'c1', redirectUris: [] });
  revokeByHash.mockReset().mockResolvedValue(undefined);
});

describe('POST /revoke', () => {
  it('revokes a token and returns 200', async () => {
    const res = await POST(revokeReq({ token: 'AT', client_id: 'c1' }));
    expect(res.status).toBe(200);
    expect(revokeByHash).toHaveBeenCalledWith('AT', expect.any(Number));
  });

  it('returns 200 for an unknown token (RFC 7009 §2.2)', async () => {
    revokeByHash.mockResolvedValue(undefined); // no-op for unknown
    const res = await POST(revokeReq({ token: 'nope', client_id: 'c1' }));
    expect(res.status).toBe(200);
  });

  it('unknown client → 401 invalid_client', async () => {
    getClient.mockResolvedValue(null);
    const res = await POST(revokeReq({ token: 'AT', client_id: 'ghost' }));
    expect(res.status).toBe(401);
  });

  it('missing token → 200 (nothing to do, still success)', async () => {
    const res = await POST(revokeReq({ client_id: 'c1' }));
    expect(res.status).toBe(200);
  });
});
