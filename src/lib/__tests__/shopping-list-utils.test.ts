import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../vitest.setup';

const {
  fetchStores,
  fetchStore,
  createStore,
  updateStore,
  deleteStore,
  fetchShoppingList,
  updateShoppingList,
  inviteUserToStore,
  respondToInvitation,
  removeUserFromStore,
  fetchPendingInvitations,
  fetchPurchaseHistory,
  finishShop,
} = await import('../shopping-list-utils');

describe('fetchStores', () => {
  it('returns the parsed list of stores', async () => {
    const stores = [{ _id: 's1', name: 'Market' }];
    server.use(http.get('/api/stores', () => HttpResponse.json(stores)));

    const result = await fetchStores();
    expect(result).toEqual(stores);
  });

  it('throws on non-ok response', async () => {
    server.use(http.get('/api/stores', () => HttpResponse.json({}, { status: 500 })));

    await expect(fetchStores()).rejects.toThrow('Failed to fetch stores');
  });
});

describe('fetchStore', () => {
  it('returns the parsed store for the given id', async () => {
    const store = { _id: 's1', name: 'Market' };
    server.use(http.get('/api/stores/:id', () => HttpResponse.json(store)));

    const result = await fetchStore('s1');
    expect(result).toEqual(store);
  });

  it('throws on non-ok response', async () => {
    server.use(http.get('/api/stores/:id', () => HttpResponse.json({}, { status: 404 })));

    await expect(fetchStore('s1')).rejects.toThrow('Failed to fetch store');
  });
});

describe('createStore', () => {
  it('posts the payload and returns the created store', async () => {
    let body: unknown = null;
    const created = { _id: 's1', name: 'New Store' };
    server.use(
      http.post('/api/stores', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(created, { status: 201 });
      })
    );

    const result = await createStore({ name: 'New Store' });
    expect(result).toEqual(created);
    expect(body).toEqual({ name: 'New Store' });
  });

  it('throws the server error message on non-ok response', async () => {
    server.use(
      http.post('/api/stores', () =>
        HttpResponse.json({ error: 'Store already exists' }, { status: 409 })
      )
    );

    await expect(createStore({ name: 'Dup' })).rejects.toThrow('Store already exists');
  });

  it('throws a generic message when the error response has no error field', async () => {
    server.use(http.post('/api/stores', () => HttpResponse.json({}, { status: 500 })));

    await expect(createStore({ name: 'X' })).rejects.toThrow('Failed to create store');
  });
});

describe('updateStore', () => {
  it('puts the payload and returns the updated store', async () => {
    let body: unknown = null;
    const updated = { _id: 's1', name: 'Renamed' };
    server.use(
      http.put('/api/stores/:id', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(updated);
      })
    );

    const result = await updateStore('s1', { name: 'Renamed' });
    expect(result).toEqual(updated);
    expect(body).toEqual({ name: 'Renamed' });
  });

  it('throws the server error message on non-ok response', async () => {
    server.use(
      http.put('/api/stores/:id', () => HttpResponse.json({ error: 'Forbidden' }, { status: 403 }))
    );

    await expect(updateStore('s1', { name: 'X' })).rejects.toThrow('Forbidden');
  });

  it('throws a generic message when the error response has no error field', async () => {
    server.use(http.put('/api/stores/:id', () => HttpResponse.json({}, { status: 500 })));

    await expect(updateStore('s1', { name: 'X' })).rejects.toThrow('Failed to update store');
  });
});

describe('deleteStore', () => {
  it('returns the parsed success payload', async () => {
    const payload = { success: true, sharedUserCount: 2 };
    server.use(http.delete('/api/stores/:id', () => HttpResponse.json(payload)));

    const result = await deleteStore('s1');
    expect(result).toEqual(payload);
  });

  it('throws on non-ok response', async () => {
    server.use(http.delete('/api/stores/:id', () => HttpResponse.json({}, { status: 403 })));

    await expect(deleteStore('s1')).rejects.toThrow('Failed to delete store');
  });
});

describe('fetchShoppingList', () => {
  it('returns the parsed shopping list', async () => {
    const list = { _id: 'l1', storeId: 's1', items: [] };
    server.use(http.get('/api/shopping-lists/:storeId', () => HttpResponse.json(list)));

    const result = await fetchShoppingList('s1');
    expect(result).toEqual(list);
  });

  it('throws on non-ok response', async () => {
    server.use(
      http.get('/api/shopping-lists/:storeId', () => HttpResponse.json({}, { status: 404 }))
    );

    await expect(fetchShoppingList('s1')).rejects.toThrow('Failed to fetch shopping list');
  });
});

describe('updateShoppingList', () => {
  it('puts the payload and returns the updated list', async () => {
    let body: unknown = null;
    const updated = { _id: 'l1', storeId: 's1', items: [] };
    server.use(
      http.put('/api/shopping-lists/:storeId', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(updated);
      })
    );

    const result = await updateShoppingList('s1', { items: [] });
    expect(result).toEqual(updated);
    expect(body).toEqual({ items: [] });
  });

  it('throws the server error message on non-ok response', async () => {
    server.use(
      http.put('/api/shopping-lists/:storeId', () =>
        HttpResponse.json({ error: 'Conflict' }, { status: 409 })
      )
    );

    await expect(updateShoppingList('s1', { items: [] })).rejects.toThrow('Conflict');
  });

  it('throws a generic message when the error response has no error field', async () => {
    server.use(
      http.put('/api/shopping-lists/:storeId', () => HttpResponse.json({}, { status: 500 }))
    );

    await expect(updateShoppingList('s1', { items: [] })).rejects.toThrow(
      'Failed to update shopping list'
    );
  });
});

describe('inviteUserToStore', () => {
  it('posts the email and resolves on success', async () => {
    let body: unknown = null;
    server.use(
      http.post('/api/stores/:storeId/invite', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({}, { status: 200 });
      })
    );

    await expect(inviteUserToStore('s1', 'friend@example.com')).resolves.toBeUndefined();
    expect(body).toEqual({ email: 'friend@example.com' });
  });

  it('throws the server error message on non-ok response', async () => {
    server.use(
      http.post('/api/stores/:storeId/invite', () =>
        HttpResponse.json({ error: 'User already invited' }, { status: 409 })
      )
    );

    await expect(inviteUserToStore('s1', 'friend@example.com')).rejects.toThrow(
      'User already invited'
    );
  });

  it('throws a generic message when the error response has no error field', async () => {
    server.use(
      http.post('/api/stores/:storeId/invite', () => HttpResponse.json({}, { status: 500 }))
    );

    await expect(inviteUserToStore('s1', 'friend@example.com')).rejects.toThrow(
      'Failed to invite user'
    );
  });
});

describe('respondToInvitation', () => {
  it('puts the action and resolves on success', async () => {
    let body: unknown = null;
    server.use(
      http.put('/api/stores/:storeId/invitations/:userId', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({}, { status: 200 });
      })
    );

    await expect(respondToInvitation('s1', 'u1', 'accept')).resolves.toBeUndefined();
    expect(body).toEqual({ action: 'accept' });
  });

  it('throws the server error message on non-ok response', async () => {
    server.use(
      http.put('/api/stores/:storeId/invitations/:userId', () =>
        HttpResponse.json({ error: 'Invitation expired' }, { status: 410 })
      )
    );

    await expect(respondToInvitation('s1', 'u1', 'accept')).rejects.toThrow('Invitation expired');
  });

  it('throws an action-specific generic message when the error response has no error field', async () => {
    server.use(
      http.put('/api/stores/:storeId/invitations/:userId', () =>
        HttpResponse.json({}, { status: 500 })
      )
    );

    await expect(respondToInvitation('s1', 'u1', 'reject')).rejects.toThrow(
      'Failed to reject invitation'
    );
  });
});

describe('removeUserFromStore', () => {
  it('deletes the invitation and resolves on success', async () => {
    server.use(
      http.delete('/api/stores/:storeId/invitations/:userId', () =>
        HttpResponse.json({}, { status: 200 })
      )
    );

    await expect(removeUserFromStore('s1', 'u1')).resolves.toBeUndefined();
  });

  it('throws on non-ok response', async () => {
    server.use(
      http.delete('/api/stores/:storeId/invitations/:userId', () =>
        HttpResponse.json({ error: 'Forbidden' }, { status: 403 })
      )
    );

    await expect(removeUserFromStore('s1', 'u1')).rejects.toThrow(
      'Failed to remove user from store'
    );
  });
});

describe('fetchPendingInvitations', () => {
  it('returns the parsed list of pending invitations', async () => {
    const invitations = [
      {
        storeId: 's1',
        storeName: 'Market',
        invitation: {
          userId: 'u1',
          userEmail: 'me@example.com',
          status: 'pending',
          invitedBy: 'owner',
          invitedAt: '2026-05-01',
        },
      },
    ];
    server.use(http.get('/api/stores/invitations', () => HttpResponse.json(invitations)));

    const result = await fetchPendingInvitations();
    expect(result).toEqual(invitations);
  });

  it('throws on non-ok response', async () => {
    server.use(http.get('/api/stores/invitations', () => HttpResponse.json({}, { status: 500 })));

    await expect(fetchPendingInvitations()).rejects.toThrow('Failed to fetch pending invitations');
  });
});

describe('fetchPurchaseHistory', () => {
  it('fetches history for the given storeId', async () => {
    const mockHistory = [
      {
        foodItemId: 'f1',
        name: 'Milk',
        quantity: 2,
        unit: 'gallon',
        lastPurchasedAt: '2026-02-15',
      },
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

    await expect(fetchPurchaseHistory('store123')).rejects.toThrow(
      'Failed to fetch purchase history'
    );
  });
});

describe('finishShop', () => {
  const checkedItems = [{ foodItemId: 'f1', name: 'Milk', quantity: 2, unit: 'gallon' }];

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
