import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../vitest.setup';

const { fetchPurchaseHistory, finishShop } = await import('../shopping-list-utils');

describe('fetchPurchaseHistory', () => {
  it('fetches history for the given storeId', async () => {
    const mockHistory = [
      { foodItemId: 'f1', name: 'Milk', quantity: 2, unit: 'gallon', lastPurchasedAt: '2026-02-15' },
    ];
    server.use(
      http.get('/api/shopping-lists/:storeId/history', () => {
        return HttpResponse.json(mockHistory, { status: 200 });
      })
    );

    const result = await fetchPurchaseHistory('store123');
    expect(result).toEqual(mockHistory);
  });

  it('throws on non-ok response', async () => {
    server.use(
      http.get('/api/shopping-lists/:storeId/history', () => {
        return HttpResponse.json({ error: 'Not found' }, { status: 404 });
      })
    );

    await expect(fetchPurchaseHistory('store123')).rejects.toThrow('Failed to fetch purchase history');
  });
});

describe('finishShop', () => {
  const checkedItems = [
    { foodItemId: 'f1', name: 'Milk', quantity: 2, unit: 'gallon' },
  ];

  it('posts checked items to the finish-shop endpoint', async () => {
    const mockResponse = { success: true, remainingItems: [] };
    server.use(
      http.post('/api/shopping-lists/:storeId/finish-shop', () => {
        return HttpResponse.json(mockResponse, { status: 200 });
      })
    );

    const result = await finishShop('store123', checkedItems);
    expect(result).toEqual(mockResponse);
  });

  it('throws on non-ok response with error message', async () => {
    server.use(
      http.post('/api/shopping-lists/:storeId/finish-shop', () => {
        return HttpResponse.json({ error: 'No checked items' }, { status: 400 });
      })
    );

    await expect(finishShop('store123', checkedItems)).rejects.toThrow('No checked items');
  });

  it('throws generic message when no error in response', async () => {
    server.use(
      http.post('/api/shopping-lists/:storeId/finish-shop', () => {
        return HttpResponse.json({}, { status: 500 });
      })
    );

    await expect(finishShop('store123', checkedItems)).rejects.toThrow('Failed to finish shop');
  });
});
