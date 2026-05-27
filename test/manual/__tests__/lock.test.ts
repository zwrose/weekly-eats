// test/manual/__tests__/lock.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { acquireLock, releaseLock, forceUnlock, readLock } from '../lock.js';
import type { Db } from 'mongodb';

function mockDb() {
  const insertOne = vi.fn();
  const deleteOne = vi.fn();
  const findOne = vi.fn();
  const createIndex = vi.fn().mockResolvedValue('ok');
  return {
    db: {
      collection: vi.fn(() => ({
        insertOne,
        deleteOne,
        findOne,
        createIndex,
      })),
    } as unknown as Db,
    insertOne,
    deleteOne,
    findOne,
    createIndex,
  };
}

describe('acquireLock', () => {
  let m: ReturnType<typeof mockDb>;
  beforeEach(() => {
    m = mockDb();
  });

  it('inserts a lock doc and returns metadata', async () => {
    m.insertOne.mockResolvedValue({ insertedId: 'id1' });
    const lock = await acquireLock(m.db, 'feat/x::default', 'apply feat/x');
    expect(lock.manifestId).toBe('feat/x::default');
    expect(lock.acquiredAt).toBeInstanceOf(Date);
    expect(lock.expireAt.getTime() - lock.acquiredAt.getTime()).toBe(300_000);
    expect(m.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        manifestId: 'feat/x::default',
        pid: expect.any(Number),
        hostname: expect.any(String),
        cliInvocation: 'apply feat/x',
      })
    );
  });

  it('throws a structured "lock held" error on duplicate-key', async () => {
    const dupErr: any = new Error('E11000 duplicate key');
    dupErr.code = 11000;
    m.insertOne.mockRejectedValue(dupErr);
    m.findOne.mockResolvedValue({
      manifestId: 'feat/x::default',
      acquiredAt: new Date('2026-05-26T11:58:33Z'),
      expireAt: new Date('2026-05-26T12:03:33Z'),
      pid: 12345,
      hostname: 'laptop.local',
      cliInvocation: 'apply feat/x',
    });
    await expect(acquireLock(m.db, 'feat/x::default', 'apply feat/x')).rejects.toThrow(
      /another apply is in progress/i
    );
  });

  it('ensures TTL index is created idempotently', async () => {
    m.insertOne.mockResolvedValue({ insertedId: 'id1' });
    await acquireLock(m.db, 'feat/x::default', 'apply feat/x');
    expect(m.createIndex).toHaveBeenCalledWith(
      { expireAt: 1 },
      expect.objectContaining({ expireAfterSeconds: 0 })
    );
    expect(m.createIndex).toHaveBeenCalledWith(
      { manifestId: 1 },
      expect.objectContaining({ unique: true })
    );
  });
});

describe('releaseLock', () => {
  it('deletes by manifestId', async () => {
    const m = mockDb();
    await releaseLock(m.db, 'feat/x::default');
    expect(m.deleteOne).toHaveBeenCalledWith({ manifestId: 'feat/x::default' });
  });
});

describe('forceUnlock', () => {
  it('returns lock metadata before deleting', async () => {
    const m = mockDb();
    const lockDoc = {
      manifestId: 'feat/x::default',
      acquiredAt: new Date(),
      expireAt: new Date(),
      pid: 1,
      hostname: 'h',
      cliInvocation: 'apply x',
    };
    m.findOne.mockResolvedValue(lockDoc);
    const result = await forceUnlock(m.db, 'feat/x::default');
    expect(result).toEqual(lockDoc);
    expect(m.deleteOne).toHaveBeenCalledWith({ manifestId: 'feat/x::default' });
  });

  it('returns null when no lock exists', async () => {
    const m = mockDb();
    m.findOne.mockResolvedValue(null);
    const result = await forceUnlock(m.db, 'feat/x::default');
    expect(result).toBeNull();
  });
});
