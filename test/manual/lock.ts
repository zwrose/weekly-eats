// test/manual/lock.ts
import type { Db } from 'mongodb';
import { hostname } from 'node:os';
import type { ManualTestLockDoc } from './types.js';

const LOCK_TTL_SECONDS = 300;
const COLLECTION = 'manualTestLocks';

async function ensureIndexes(db: Db): Promise<void> {
  const col = db.collection<ManualTestLockDoc>(COLLECTION);
  await col.createIndex({ manifestId: 1 }, { name: 'manualTestLocks_manifestId', unique: true });
  await col.createIndex(
    { expireAt: 1 },
    { name: 'manualTestLocks_expireAt_ttl', expireAfterSeconds: 0 }
  );
}

export interface AcquiredLock {
  manifestId: string;
  acquiredAt: Date;
  expireAt: Date;
}

export async function acquireLock(
  db: Db,
  manifestId: string,
  cliInvocation: string
): Promise<AcquiredLock> {
  await ensureIndexes(db);
  const col = db.collection<ManualTestLockDoc>(COLLECTION);
  const acquiredAt = new Date();
  const expireAt = new Date(acquiredAt.getTime() + LOCK_TTL_SECONDS * 1000);
  const doc: ManualTestLockDoc = {
    manifestId,
    acquiredAt,
    expireAt,
    pid: process.pid,
    hostname: hostname(),
    cliInvocation,
  };
  try {
    await col.insertOne(doc);
    return { manifestId, acquiredAt, expireAt };
  } catch (e: unknown) {
    const err = e as { code?: number };
    if (err?.code === 11000) {
      const held = await col.findOne({ manifestId });
      const heldBy = held
        ? `PID ${held.pid} on host ${held.hostname} at ${held.acquiredAt.toISOString()} (invocation: ${held.cliInvocation})`
        : 'unknown';
      throw new Error(
        `another apply is in progress\n  manifest: ${manifestId}\n  acquired by: ${heldBy}\n  hint: if the previous process crashed, run \`npm run test:manual:unlock\``
      );
    }
    throw e;
  }
}

export async function releaseLock(db: Db, manifestId: string): Promise<void> {
  const col = db.collection<ManualTestLockDoc>(COLLECTION);
  await col.deleteOne({ manifestId });
}

export async function forceUnlock(db: Db, manifestId: string): Promise<ManualTestLockDoc | null> {
  const col = db.collection<ManualTestLockDoc>(COLLECTION);
  const existing = await col.findOne({ manifestId });
  await col.deleteOne({ manifestId });
  return existing;
}

export async function readLock(db: Db, manifestId: string): Promise<ManualTestLockDoc | null> {
  const col = db.collection<ManualTestLockDoc>(COLLECTION);
  return col.findOne({ manifestId });
}
