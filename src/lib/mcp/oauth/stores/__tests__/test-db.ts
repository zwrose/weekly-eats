// src/lib/mcp/oauth/stores/__tests__/test-db.ts
import { vi } from 'vitest';

/**
 * Build an in-memory fake of the Mongo methods our stores use. Each collection
 * is backed by an array of docs; methods mutate it the way the real driver
 * (close enough) would. Returns the spies so tests can assert call args.
 */
export function makeFakeDb() {
  const store = new Map<string, any[]>();
  const col = (name: string) => {
    if (!store.has(name)) store.set(name, []);
    return store.get(name)!;
  };
  const matches = (doc: any, filter: any) =>
    Object.entries(filter).every(([k, v]) => {
      // Range operators ($gt/$gte/$lt/$lte). A Date filter value is an equality
      // match, not an operator object.
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        const ops = v as Record<string, any>;
        if ('$gt' in ops && !(doc[k] > ops.$gt)) return false;
        if ('$gte' in ops && !(doc[k] >= ops.$gte)) return false;
        if ('$lt' in ops && !(doc[k] < ops.$lt)) return false;
        if ('$lte' in ops && !(doc[k] <= ops.$lte)) return false;
        return true;
      }
      if (v === null) return doc[k] === null || doc[k] === undefined;
      return doc[k] === v;
    });

  // Apply $set and $inc to a target doc, mirroring the driver.
  const applyUpdate = (target: any, update: any) => {
    if (update.$set) Object.assign(target, update.$set);
    if (update.$inc)
      for (const [k, n] of Object.entries(update.$inc))
        target[k] = (target[k] ?? 0) + (n as number);
  };

  const collection = vi.fn((name: string) => ({
    findOne: vi.fn(async (filter: any) => col(name).find((d) => matches(d, filter)) ?? null),
    insertOne: vi.fn(async (doc: any) => {
      col(name).push({ ...doc });
      return { insertedId: 'fake-id' };
    }),
    findOneAndDelete: vi.fn(async (filter: any) => {
      const arr = col(name);
      const i = arr.findIndex((d) => matches(d, filter));
      if (i === -1) return null;
      return arr.splice(i, 1)[0];
    }),
    findOneAndUpdate: vi.fn(async (filter: any, update: any) => {
      const arr = col(name);
      const i = arr.findIndex((d) => matches(d, filter));
      if (i === -1) return null;
      applyUpdate(arr[i], update);
      return arr[i];
    }),
    updateOne: vi.fn(async (filter: any, update: any, opts: any = {}) => {
      const arr = col(name);
      const i = arr.findIndex((d) => matches(d, filter));
      if (i === -1) {
        if (opts.upsert) {
          const doc = { ...filter, ...(update.$setOnInsert ?? {}) };
          applyUpdate(doc, update);
          arr.push(doc);
        }
        return { matchedCount: 0, upsertedCount: opts.upsert ? 1 : 0 };
      }
      applyUpdate(arr[i], update);
      return { matchedCount: 1, upsertedCount: 0 };
    }),
    updateMany: vi.fn(async (filter: any, update: any) => {
      let n = 0;
      for (const d of col(name))
        if (matches(d, filter)) {
          Object.assign(d, update.$set ?? {});
          n++;
        }
      return { matchedCount: n };
    }),
  }));

  return { db: { collection }, collection, store };
}
