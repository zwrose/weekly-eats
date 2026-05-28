// test/manual/diff-tools.ts
import { ObjectId } from 'mongodb';

function isObjectId(v: unknown): boolean {
  if (v instanceof ObjectId) return true;
  if (typeof v !== 'object' || v === null) return false;
  if (!('_bsontype' in v)) return false;
  return (v as { _bsontype: unknown })._bsontype === 'ObjectID';
}

export function normalizeDoc(
  doc: Record<string, unknown>,
  dropFields: string[],
  dropTimestampFields: string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) {
    // ObjectId values are normalized (replaced) regardless of dropFields
    if (isObjectId(v)) {
      result[k] = '<OBJECTID>';
      continue;
    }
    if (dropFields.includes(k)) continue;
    if (dropTimestampFields.includes(k)) continue;
    result[k] = normalizeValue(v);
  }
  return result;
}

function normalizeValue(v: unknown): unknown {
  if (isObjectId(v)) return '<OBJECTID>';
  if (v instanceof Date) return '<DATE>';
  if (Array.isArray(v)) return v.map(normalizeValue);
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = normalizeValue(x);
    return o;
  }
  return v;
}

export function normalizeCollection(
  docs: Array<Record<string, unknown>>,
  opts: { sortKey?: string; dropFields?: string[]; dropTimestampFields?: string[] } = {}
): Array<Record<string, unknown>> {
  const normalized = docs.map((d) =>
    normalizeDoc(d, opts.dropFields ?? [], opts.dropTimestampFields ?? [])
  );
  if (opts.sortKey) {
    normalized.sort((a, b) => {
      const va = String(a[opts.sortKey!] ?? '');
      const vb = String(b[opts.sortKey!] ?? '');
      return va.localeCompare(vb);
    });
  }
  return normalized;
}

export interface DiffOptions {
  ignoreObjectId?: boolean;
  ignoreFields: string[];
  ignoreTimestampFields?: string[];
  sortKey?: string;
}

export function diffCollections(
  a: Array<Record<string, unknown>>,
  b: Array<Record<string, unknown>>,
  opts: DiffOptions
): string[] {
  const na = normalizeCollection(a, {
    dropFields: opts.ignoreFields,
    dropTimestampFields: opts.ignoreTimestampFields ?? ['createdAt', 'updatedAt'],
    sortKey: opts.sortKey,
  });
  const nb = normalizeCollection(b, {
    dropFields: opts.ignoreFields,
    dropTimestampFields: opts.ignoreTimestampFields ?? ['createdAt', 'updatedAt'],
    sortKey: opts.sortKey,
  });

  const diffs: string[] = [];
  const max = Math.max(na.length, nb.length);
  for (let i = 0; i < max; i++) {
    const sa = JSON.stringify(na[i] ?? null);
    const sb = JSON.stringify(nb[i] ?? null);
    if (sa !== sb) diffs.push(`doc ${i}: ${sa} !== ${sb}`);
  }
  return diffs;
}
