import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../vitest.setup';
import { fetchPantryItems, createPantryItem, deletePantryItem } from '../pantry-utils';

describe('fetchPantryItems', () => {
  it('returns the inner data array', async () => {
    const items = [
      { _id: 'p1', foodItemId: 'f1', quantity: 2 },
      { _id: 'p2', foodItemId: 'f2', quantity: 1 },
    ];
    server.use(
      http.get('/api/pantry', () => {
        return HttpResponse.json({ data: items }, { status: 200 });
      })
    );

    const result = await fetchPantryItems();
    expect(result).toEqual(items);
  });

  it('throws on non-ok response', async () => {
    server.use(
      http.get('/api/pantry', () => {
        return HttpResponse.json({ error: 'boom' }, { status: 500 });
      })
    );

    await expect(fetchPantryItems()).rejects.toThrow('Failed to fetch pantry items');
  });
});

describe('createPantryItem', () => {
  const newItem = { foodItemId: 'f1' };

  it('throws with the server error message when present', async () => {
    server.use(
      http.post('/api/pantry', () => {
        return HttpResponse.json({ error: 'Invalid item' }, { status: 400 });
      })
    );

    await expect(createPantryItem(newItem)).rejects.toThrow('Invalid item');
  });

  it('throws the generic message when no error in response', async () => {
    server.use(
      http.post('/api/pantry', () => {
        return HttpResponse.json({}, { status: 500 });
      })
    );

    await expect(createPantryItem(newItem)).rejects.toThrow('Failed to create pantry item');
  });
});

describe('deletePantryItem', () => {
  it('throws with the server error message when present', async () => {
    server.use(
      http.delete('/api/pantry/:id', () => {
        return HttpResponse.json({ error: 'Not found' }, { status: 404 });
      })
    );

    await expect(deletePantryItem('p1')).rejects.toThrow('Not found');
  });

  it('throws the generic message when no error in response', async () => {
    server.use(
      http.delete('/api/pantry/:id', () => {
        return HttpResponse.json({}, { status: 500 });
      })
    );

    await expect(deletePantryItem('p1')).rejects.toThrow('Failed to delete pantry item');
  });
});
