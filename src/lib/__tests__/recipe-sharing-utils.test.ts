import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../vitest.setup';

const {
  inviteUserToRecipeSharing,
  respondToRecipeSharingInvitation,
  removeUserFromRecipeSharing,
  fetchPendingRecipeSharingInvitations,
  fetchSharedRecipeUsers,
  fetchRecipeSharingOwners,
} = await import('../recipe-sharing-utils');

describe('inviteUserToRecipeSharing', () => {
  it('resolves on ok response', async () => {
    server.use(
      http.post('/api/user/recipe-sharing/invite', () => {
        return HttpResponse.json({ success: true }, { status: 200 });
      })
    );

    await expect(
      inviteUserToRecipeSharing('friend@example.com', ['tags', 'ratings'])
    ).resolves.toBeUndefined();
  });

  it('throws with server error message on non-ok response', async () => {
    server.use(
      http.post('/api/user/recipe-sharing/invite', () => {
        return HttpResponse.json({ error: 'User not found' }, { status: 404 });
      })
    );

    await expect(inviteUserToRecipeSharing('friend@example.com', ['tags'])).rejects.toThrow(
      'User not found'
    );
  });
});

describe('respondToRecipeSharingInvitation', () => {
  it('resolves on ok response', async () => {
    server.use(
      http.put('/api/user/recipe-sharing/invitations/:userId', () => {
        return HttpResponse.json({ success: true }, { status: 200 });
      })
    );

    await expect(respondToRecipeSharingInvitation('user123', 'accept')).resolves.toBeUndefined();
  });

  it('throws on non-ok response', async () => {
    server.use(
      http.put('/api/user/recipe-sharing/invitations/:userId', () => {
        return HttpResponse.json({}, { status: 500 });
      })
    );

    await expect(respondToRecipeSharingInvitation('user123', 'reject')).rejects.toThrow(
      'Failed to respond to invitation'
    );
  });
});

describe('removeUserFromRecipeSharing', () => {
  it('resolves on ok response', async () => {
    server.use(
      http.delete('/api/user/recipe-sharing/invitations/:userId', () => {
        return HttpResponse.json({ success: true }, { status: 200 });
      })
    );

    await expect(removeUserFromRecipeSharing('user123')).resolves.toBeUndefined();
  });

  it('throws on non-ok response', async () => {
    server.use(
      http.delete('/api/user/recipe-sharing/invitations/:userId', () => {
        return HttpResponse.json({}, { status: 500 });
      })
    );

    await expect(removeUserFromRecipeSharing('user123')).rejects.toThrow(
      'Failed to remove user from sharing'
    );
  });
});

describe('fetchPendingRecipeSharingInvitations', () => {
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
          sharingTypes: ['tags'],
        },
      },
    ];
    server.use(
      http.get('/api/user/recipe-sharing/invitations', () => {
        return HttpResponse.json(mockInvitations, { status: 200 });
      })
    );

    const result = await fetchPendingRecipeSharingInvitations();
    expect(result).toEqual(mockInvitations);
  });

  it('throws on non-ok response', async () => {
    server.use(
      http.get('/api/user/recipe-sharing/invitations', () => {
        return HttpResponse.json({}, { status: 500 });
      })
    );

    await expect(fetchPendingRecipeSharingInvitations()).rejects.toThrow(
      'Failed to fetch pending invitations'
    );
  });
});

describe('fetchSharedRecipeUsers', () => {
  it('returns the parsed shared-users list', async () => {
    const mockUsers = [{ userId: 'u1', email: 'a@example.com', sharingTypes: ['tags', 'ratings'] }];
    server.use(
      http.get('/api/user/recipe-sharing/shared-users', () => {
        return HttpResponse.json(mockUsers, { status: 200 });
      })
    );

    const result = await fetchSharedRecipeUsers();
    expect(result).toEqual(mockUsers);
  });

  it('throws on non-ok response', async () => {
    server.use(
      http.get('/api/user/recipe-sharing/shared-users', () => {
        return HttpResponse.json({}, { status: 500 });
      })
    );

    await expect(fetchSharedRecipeUsers()).rejects.toThrow('Failed to fetch shared users');
  });
});

describe('fetchRecipeSharingOwners', () => {
  it('returns the parsed owners list', async () => {
    const mockOwners = [{ userId: 'u2', email: 'b@example.com', sharingTypes: ['ratings'] }];
    server.use(
      http.get('/api/user/recipe-sharing/owners', () => {
        return HttpResponse.json(mockOwners, { status: 200 });
      })
    );

    const result = await fetchRecipeSharingOwners();
    expect(result).toEqual(mockOwners);
  });

  it('throws on non-ok response', async () => {
    server.use(
      http.get('/api/user/recipe-sharing/owners', () => {
        return HttpResponse.json({}, { status: 500 });
      })
    );

    await expect(fetchRecipeSharingOwners()).rejects.toThrow(
      'Failed to fetch recipe sharing owners'
    );
  });
});
