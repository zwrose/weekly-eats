import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../vitest.setup';
import type { ShoppingListItem } from '../../types/shopping-list';

const { insertItemAtPosition, saveItemPositions, getItemPosition, getStorePositions } =
  await import('../shopping-list-position-utils');

function makeItem(foodItemId: string, name = foodItemId): ShoppingListItem {
  return { foodItemId, name, quantity: 1, unit: 'each', checked: false };
}

describe('insertItemAtPosition', () => {
  const a = makeItem('a');
  const b = makeItem('b');
  const c = makeItem('c');
  const newItem = makeItem('new');

  it('appends to the end when remembered position is null', () => {
    const result = insertItemAtPosition([a, b], newItem, null);
    expect(result.map((i) => i.foodItemId)).toEqual(['a', 'b', 'new']);
  });

  it('adds the item when the list is empty (with a position)', () => {
    const result = insertItemAtPosition([], newItem, 0.5);
    expect(result.map((i) => i.foodItemId)).toEqual(['new']);
  });

  it('appends to an empty list when position is null', () => {
    const result = insertItemAtPosition([], newItem, null);
    expect(result.map((i) => i.foodItemId)).toEqual(['new']);
  });

  it('inserts at the front for position 0', () => {
    const result = insertItemAtPosition([a, b, c], newItem, 0);
    expect(result.map((i) => i.foodItemId)).toEqual(['new', 'a', 'b', 'c']);
  });

  it('inserts at the end for position 1', () => {
    const result = insertItemAtPosition([a, b, c], newItem, 1);
    expect(result.map((i) => i.foodItemId)).toEqual(['a', 'b', 'c', 'new']);
  });

  it('inserts in the middle for a mid-range position', () => {
    // targetIndex = round(0.5 * 3) = 2
    const result = insertItemAtPosition([a, b, c], newItem, 0.5);
    expect(result.map((i) => i.foodItemId)).toEqual(['a', 'b', 'new', 'c']);
  });

  it('does not mutate the original list', () => {
    const items = [a, b];
    const result = insertItemAtPosition(items, newItem, 0);
    expect(items.map((i) => i.foodItemId)).toEqual(['a', 'b']);
    expect(result).not.toBe(items);
  });
});

describe('saveItemPositions', () => {
  it('does not POST when the list is empty', async () => {
    let called = false;
    server.use(
      http.post('/api/shopping-lists/:storeId/positions', () => {
        called = true;
        return HttpResponse.json({});
      })
    );

    await saveItemPositions('store123', []);
    expect(called).toBe(false);
  });

  it('posts a single item at position 0.5', async () => {
    let body: { positions: Array<{ foodItemId: string; position: number }> } | null = null;
    server.use(
      http.post('/api/shopping-lists/:storeId/positions', async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json({});
      })
    );

    await saveItemPositions('store123', [makeItem('only')]);
    expect(body).toEqual({ positions: [{ foodItemId: 'only', position: 0.5 }] });
  });

  it('computes evenly spaced relative positions for multiple items', async () => {
    let body: { positions: Array<{ foodItemId: string; position: number }> } | null = null;
    server.use(
      http.post('/api/shopping-lists/:storeId/positions', async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json({});
      })
    );

    await saveItemPositions('store123', [makeItem('a'), makeItem('b'), makeItem('c')]);
    // positions are i / (n - 1): 0/2, 1/2, 2/2
    expect(body).toEqual({
      positions: [
        { foodItemId: 'a', position: 0 },
        { foodItemId: 'b', position: 0.5 },
        { foodItemId: 'c', position: 1 },
      ],
    });
  });

  it('clamps positions to the 0-1 range', async () => {
    let body: { positions: Array<{ foodItemId: string; position: number }> } | null = null;
    server.use(
      http.post('/api/shopping-lists/:storeId/positions', async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json({});
      })
    );

    await saveItemPositions('store123', [makeItem('a'), makeItem('b')]);
    const positions = body!.positions;
    for (const p of positions) {
      expect(p.position).toBeGreaterThanOrEqual(0);
      expect(p.position).toBeLessThanOrEqual(1);
    }
  });

  it('swallows errors and does not throw (non-critical)', async () => {
    server.use(http.post('/api/shopping-lists/:storeId/positions', () => HttpResponse.error()));

    await expect(saveItemPositions('store123', [makeItem('a')])).resolves.toBeUndefined();
  });
});

describe('getItemPosition', () => {
  it('returns the position from a happy-path response', async () => {
    server.use(
      http.get('/api/shopping-lists/:storeId/positions', () =>
        HttpResponse.json({ position: 0.42 })
      )
    );

    const result = await getItemPosition('store123', 'food1');
    expect(result).toBe(0.42);
  });

  it('returns null when the response has no position field', async () => {
    server.use(http.get('/api/shopping-lists/:storeId/positions', () => HttpResponse.json({})));

    const result = await getItemPosition('store123', 'food1');
    expect(result).toBeNull();
  });

  it('returns null on a non-ok response', async () => {
    server.use(
      http.get('/api/shopping-lists/:storeId/positions', () =>
        HttpResponse.json({ error: 'nope' }, { status: 404 })
      )
    );

    const result = await getItemPosition('store123', 'food1');
    expect(result).toBeNull();
  });

  it('returns null when the fetch throws', async () => {
    server.use(http.get('/api/shopping-lists/:storeId/positions', () => HttpResponse.error()));

    const result = await getItemPosition('store123', 'food1');
    expect(result).toBeNull();
  });
});

describe('getStorePositions', () => {
  it('builds a Map from data.positions on a happy-path response', async () => {
    server.use(
      http.get('/api/shopping-lists/:storeId/positions', () =>
        HttpResponse.json({
          positions: [
            { foodItemId: 'a', position: 0 },
            { foodItemId: 'b', position: 0.5 },
          ],
        })
      )
    );

    const result = await getStorePositions('store123');
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(2);
    expect(result.get('a')).toBe(0);
    expect(result.get('b')).toBe(0.5);
  });

  it('returns an empty Map when positions is missing/not an array', async () => {
    server.use(http.get('/api/shopping-lists/:storeId/positions', () => HttpResponse.json({})));

    const result = await getStorePositions('store123');
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it('returns an empty Map on a non-ok response', async () => {
    server.use(
      http.get('/api/shopping-lists/:storeId/positions', () =>
        HttpResponse.json({ error: 'nope' }, { status: 500 })
      )
    );

    const result = await getStorePositions('store123');
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it('returns an empty Map when the fetch throws', async () => {
    server.use(http.get('/api/shopping-lists/:storeId/positions', () => HttpResponse.error()));

    const result = await getStorePositions('store123');
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });
});
