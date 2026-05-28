// test/manual/__tests__/diff-tools.test.ts
import { describe, it, expect } from 'vitest';
import { ObjectId } from 'mongodb';
import { normalizeDoc, normalizeCollection, diffCollections } from '../diff-tools.js';

describe('normalizeDoc', () => {
  it('replaces ObjectIds with stable placeholder', () => {
    const d = { _id: new ObjectId(), name: 'x', ref: new ObjectId() };
    const out = normalizeDoc(
      d,
      ['_id', '_seedManifestId', '_seedScenarioId'],
      ['createdAt', 'updatedAt']
    );
    expect(out._id).toBe('<OBJECTID>');
    expect(out.ref).toBe('<OBJECTID>');
    expect(out.name).toBe('x');
  });

  it('drops ignored fields entirely', () => {
    const d = {
      _id: 'x',
      _seedManifestId: 'a',
      _seedScenarioId: 'b',
      name: 'foo',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const out = normalizeDoc(d, ['_seedManifestId', '_seedScenarioId'], ['createdAt', 'updatedAt']);
    expect(out._seedManifestId).toBeUndefined();
    expect(out._seedScenarioId).toBeUndefined();
    expect(out.createdAt).toBeUndefined();
    expect(out.updatedAt).toBeUndefined();
    expect(out._id).toBe('x');
    expect(out.name).toBe('foo');
  });

  it('normalizes nested ObjectIds', () => {
    const d = { items: [{ id: new ObjectId() }, { id: new ObjectId() }] };
    const out = normalizeDoc(d, [], []);
    expect((out.items as any)[0].id).toBe('<OBJECTID>');
  });
});

describe('normalizeCollection', () => {
  it('sorts docs by a deterministic key for stable diff', () => {
    const docs = [
      { _id: 'b', name: 'banana' },
      { _id: 'a', name: 'apple' },
    ];
    const out = normalizeCollection(docs, { sortKey: 'name' });
    expect((out[0] as any).name).toBe('apple');
  });
});

describe('diffCollections', () => {
  it('returns empty array when collections match (modulo ignored fields)', () => {
    const a = [{ _id: new ObjectId(), name: 'x', _seedManifestId: 'a::default' }];
    const b = [{ _id: new ObjectId(), name: 'x' }];
    const diffs = diffCollections(a, b, {
      ignoreObjectId: true,
      ignoreFields: ['_seedManifestId', '_seedScenarioId'],
      sortKey: 'name',
    });
    expect(diffs).toEqual([]);
  });

  it('returns diffs when content actually differs', () => {
    const a = [{ name: 'x' }];
    const b = [{ name: 'y' }];
    expect(
      diffCollections(a, b, { ignoreObjectId: true, ignoreFields: [], sortKey: 'name' })
    ).toHaveLength(1);
  });
});
