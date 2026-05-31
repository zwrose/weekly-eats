import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const { getMongoClient } = vi.hoisted(() => ({ getMongoClient: vi.fn() }));
vi.mock('@/lib/mongodb', () => ({ getMongoClient }));

import { lookupApproval } from '../approval';

const findOne = vi.fn();
beforeEach(() => {
  findOne.mockReset();
  getMongoClient.mockResolvedValue({ db: () => ({ collection: () => ({ findOne }) }) });
});

const id = new ObjectId().toHexString();

describe('lookupApproval', () => {
  it('returns flags for an approved user', async () => {
    findOne.mockResolvedValue({ isApproved: true, isAdmin: false });
    expect(await lookupApproval(id)).toEqual({ isApproved: true, isAdmin: false });
  });

  it('returns null for an unknown user', async () => {
    findOne.mockResolvedValue(null);
    expect(await lookupApproval(id)).toBeNull();
  });

  it('returns null (not a throw) for a malformed user id', async () => {
    expect(await lookupApproval('not-an-objectid')).toBeNull();
    expect(findOne).not.toHaveBeenCalled();
  });

  it('coerces missing flags to false (fail-closed)', async () => {
    findOne.mockResolvedValue({});
    expect(await lookupApproval(id)).toEqual({ isApproved: false, isAdmin: false });
  });
});
