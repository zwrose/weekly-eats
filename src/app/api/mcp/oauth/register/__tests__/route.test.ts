import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMongoClient } = vi.hoisted(() => ({ getMongoClient: vi.fn() }));
vi.mock('@/lib/mongodb', () => ({ getMongoClient }));

import { makeFakeDb } from '@/lib/mcp/oauth/stores/__tests__/test-db';
import { POST } from '../route';

let fake: ReturnType<typeof makeFakeDb>;
beforeEach(() => {
  fake = makeFakeDb();
  getMongoClient.mockResolvedValue({ db: () => fake.db });
});

function post(body: unknown, ip = '1.2.3.4') {
  return new Request('https://app.test/api/mcp/oauth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

describe('POST /register (DCR)', () => {
  it('registers a client and returns client_id + echoed metadata', async () => {
    const res = await POST(
      post({ client_name: 'Claude', redirect_uris: ['https://claude.ai/cb'] })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.client_id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(body.redirect_uris).toEqual(['https://claude.ai/cb']);
    expect(body.token_endpoint_auth_method).toBe('none');
  });

  it('accepts http://localhost redirect_uris (RFC 8252)', async () => {
    const res = await POST(post({ redirect_uris: ['http://localhost:8080/cb'] }));
    expect(res.status).toBe(201);
  });

  it('rejects a non-HTTPS non-localhost redirect_uri → 400 (S2)', async () => {
    const res = await POST(post({ redirect_uris: ['http://attacker.example/cb'] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_redirect_uri');
  });

  it('rejects an empty redirect_uris → 400', async () => {
    const res = await POST(post({ redirect_uris: [] }));
    expect(res.status).toBe(400);
  });

  it('rate-limits a flood from one IP → 429 (I6)', async () => {
    let last: Response | undefined;
    for (let i = 0; i < 12; i++) {
      last = await POST(post({ redirect_uris: ['https://claude.ai/cb'] }, '9.9.9.9'));
    }
    expect(last!.status).toBe(429);
  });
});
