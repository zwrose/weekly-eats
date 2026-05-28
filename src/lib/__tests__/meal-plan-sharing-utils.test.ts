import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../vitest.setup';

const {
  inviteUserToMealPlanSharing,
  respondToMealPlanSharingInvitation,
  removeUserFromMealPlanSharing,
  fetchPendingMealPlanSharingInvitations,
  fetchSharedMealPlanUsers,
  fetchMealPlanOwners,
} = await import('../meal-plan-sharing-utils');

describe('inviteUserToMealPlanSharing', () => {
  it('resolves on ok response', async () => {
    server.use(
      http.post('/api/user/meal-plan-sharing/invite', () => {
        return HttpResponse.json({ success: true }, { status: 200 });
      })
    );

    await expect(inviteUserToMealPlanSharing('friend@example.com')).resolves.toBeUndefined();
  });

  it('throws with server error message on non-ok response', async () => {
    server.use(
      http.post('/api/user/meal-plan-sharing/invite', () => {
        return HttpResponse.json({ error: 'User not found' }, { status: 404 });
      })
    );

    await expect(inviteUserToMealPlanSharing('friend@example.com')).rejects.toThrow(
      'User not found'
    );
  });
});

describe('respondToMealPlanSharingInvitation', () => {
  it('resolves on ok response', async () => {
    server.use(
      http.put('/api/user/meal-plan-sharing/invitations/:userId', () => {
        return HttpResponse.json({ success: true }, { status: 200 });
      })
    );

    await expect(respondToMealPlanSharingInvitation('user123', 'accept')).resolves.toBeUndefined();
  });

  it('throws action-interpolated message when accepting', async () => {
    server.use(
      http.put('/api/user/meal-plan-sharing/invitations/:userId', () => {
        return HttpResponse.json({}, { status: 500 });
      })
    );

    await expect(respondToMealPlanSharingInvitation('user123', 'accept')).rejects.toThrow(
      'Failed to accept invitation'
    );
  });

  it('throws action-interpolated message when rejecting', async () => {
    server.use(
      http.put('/api/user/meal-plan-sharing/invitations/:userId', () => {
        return HttpResponse.json({}, { status: 500 });
      })
    );

    await expect(respondToMealPlanSharingInvitation('user123', 'reject')).rejects.toThrow(
      'Failed to reject invitation'
    );
  });
});

describe('removeUserFromMealPlanSharing', () => {
  it('resolves on ok response', async () => {
    server.use(
      http.delete('/api/user/meal-plan-sharing/invitations/:userId', () => {
        return HttpResponse.json({ success: true }, { status: 200 });
      })
    );

    await expect(removeUserFromMealPlanSharing('user123')).resolves.toBeUndefined();
  });

  it('throws on non-ok response', async () => {
    server.use(
      http.delete('/api/user/meal-plan-sharing/invitations/:userId', () => {
        return HttpResponse.json({}, { status: 500 });
      })
    );

    await expect(removeUserFromMealPlanSharing('user123')).rejects.toThrow(
      'Failed to remove user from meal plan sharing'
    );
  });
});

describe('fetchPendingMealPlanSharingInvitations', () => {
  it('returns the parsed invitation list', async () => {
    const mockInvitations = [
      {
        ownerId: 'owner1',
        ownerEmail: 'owner@example.com',
        invitation: {
          userId: 'user123',
          userEmail: 'me@example.com',
          status: 'pending',
          invitedBy: 'owner1',
          invitedAt: '2026-02-15',
        },
      },
    ];
    server.use(
      http.get('/api/user/meal-plan-sharing/invitations', () => {
        return HttpResponse.json(mockInvitations, { status: 200 });
      })
    );

    const result = await fetchPendingMealPlanSharingInvitations();
    expect(result).toEqual(mockInvitations);
  });

  it('throws on non-ok response', async () => {
    server.use(
      http.get('/api/user/meal-plan-sharing/invitations', () => {
        return HttpResponse.json({}, { status: 500 });
      })
    );

    await expect(fetchPendingMealPlanSharingInvitations()).rejects.toThrow(
      'Failed to fetch pending meal plan sharing invitations'
    );
  });
});

describe('fetchSharedMealPlanUsers', () => {
  it('returns the parsed shared-users list', async () => {
    const mockUsers = [{ userId: 'u1', email: 'a@example.com', name: 'Alice' }];
    server.use(
      http.get('/api/user/meal-plan-sharing/shared-users', () => {
        return HttpResponse.json(mockUsers, { status: 200 });
      })
    );

    const result = await fetchSharedMealPlanUsers();
    expect(result).toEqual(mockUsers);
  });

  it('throws on non-ok response', async () => {
    server.use(
      http.get('/api/user/meal-plan-sharing/shared-users', () => {
        return HttpResponse.json({}, { status: 500 });
      })
    );

    await expect(fetchSharedMealPlanUsers()).rejects.toThrow(
      'Failed to fetch shared meal plan users'
    );
  });
});

describe('fetchMealPlanOwners', () => {
  it('returns the parsed owners list', async () => {
    const mockOwners = [{ userId: 'u2', email: 'b@example.com', name: 'Bob' }];
    server.use(
      http.get('/api/user/meal-plan-sharing/owners', () => {
        return HttpResponse.json(mockOwners, { status: 200 });
      })
    );

    const result = await fetchMealPlanOwners();
    expect(result).toEqual(mockOwners);
  });

  it('throws on non-ok response', async () => {
    server.use(
      http.get('/api/user/meal-plan-sharing/owners', () => {
        return HttpResponse.json({}, { status: 500 });
      })
    );

    await expect(fetchMealPlanOwners()).rejects.toThrow('Failed to fetch meal plan owners');
  });
});
