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
      if (v && typeof v === 'object' && '$gt' in v) return doc[k] > (v as any).$gt;
      if (v === null) return doc[k] === null || doc[k] === undefined;
      return doc[k] === v;
    });

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
      Object.assign(arr[i], update.$set ?? {});
      return arr[i];
    }),
    updateOne: vi.fn(async (filter: any, update: any, opts: any = {}) => {
      const arr = col(name);
      const i = arr.findIndex((d) => matches(d, filter));
      if (i === -1) {
        if (opts.upsert)
          arr.push({ ...filter, ...(update.$set ?? {}), ...(update.$setOnInsert ?? {}) });
        return { matchedCount: 0, upsertedCount: opts.upsert ? 1 : 0 };
      }
      Object.assign(arr[i], update.$set ?? {});
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
