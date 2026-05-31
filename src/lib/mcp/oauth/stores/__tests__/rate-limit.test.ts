// src/lib/mcp/oauth/stores/__tests__/rate-limit.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeDb } from './test-db';

const { getMongoClient } = vi.hoisted(() => ({ getMongoClient: vi.fn() }));
vi.mock('@/lib/mongodb', () => ({ getMongoClient }));

import { consumeRateLimit } from '../rate-limit';

let fake: ReturnType<typeof makeFakeDb>;
beforeEach(() => {
  fake = makeFakeDb();
  getMongoClient.mockResolvedValue({ db: () => fake.db });
});

describe('rate-limit store', () => {
  it('allows up to the limit, then blocks within the window', async () => {
    const key = 'register:1.2.3.4';
    for (let i = 0; i < 3; i++) {
      const r = await consumeRateLimit(key, 3, 10_000, 1000);
      expect(r.allowed).toBe(true);
    }
    const blocked = await consumeRateLimit(key, 3, 10_000, 1000);
    expect(blocked.allowed).toBe(false);
  });

  it('resets after the window elapses', async () => {
    const key = 'register:1.2.3.4';
    for (let i = 0; i < 3; i++) await consumeRateLimit(key, 3, 10_000, 1000);
    const afterWindow = await consumeRateLimit(key, 3, 10_000, 12_000);
    expect(afterWindow.allowed).toBe(true);
  });

  it('tracks distinct keys independently', async () => {
    await consumeRateLimit('register:a', 1, 10_000, 1000);
    expect((await consumeRateLimit('register:a', 1, 10_000, 1000)).allowed).toBe(false);
    expect((await consumeRateLimit('register:b', 1, 10_000, 1000)).allowed).toBe(true);
  });
});
