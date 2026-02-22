export interface SharedUser {
  userId: string;
  email: string;
  name?: string;
  sharingTypes: ('tags' | 'ratings')[];
}

export interface PendingRecipeInvitation {
  ownerId: string;
  ownerEmail: string;
  ownerName?: string;
  invitation: {
    userId: string;
    userEmail: string;
    userName?: string;
    status: 'pending' | 'accepted' | 'rejected';
    invitedBy: string;
    invitedAt: string;
    sharingTypes: ('tags' | 'ratings')[];
  };
}

/**
 * Invite a user to share recipe tags and/or ratings
 */
export async function inviteUserToRecipeSharing(
  email: string,
  sharingTypes: ('tags' | 'ratings')[]
): Promise<void> {
  const response = await fetch('/api/user/recipe-sharing/invite', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, sharingTypes }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to invite user');
  }
}

/**
 * Respond to a recipe sharing invitation
 */
export async function respondToRecipeSharingInvitation(
  userId: string,
  action: 'accept' | 'reject'
): Promise<void> {
  const response = await fetch(`/api/user/recipe-sharing/invitations/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to respond to invitation');
  }
}

/**
 * Remove a user from recipe sharing (owner removes user OR user leaves)
 */
export async function removeUserFromRecipeSharing(userId: string): Promise<void> {
  const response = await fetch(`/api/user/recipe-sharing/invitations/${userId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove user from sharing');
  }
}

/**
 * Fetch pending recipe sharing invitations (where current user is invited)
 */
export async function fetchPendingRecipeSharingInvitations(): Promise<PendingRecipeInvitation[]> {
  const response = await fetch('/api/user/recipe-sharing/invitations');
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch pending invitations');
  }
  return response.json();
}

/**
 * Fetch users you have shared recipe data with (accepted invitations)
 */
export async function fetchSharedRecipeUsers(): Promise<SharedUser[]> {
  const response = await fetch('/api/user/recipe-sharing/shared-users');
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch shared users');
  }
  return response.json();
}

/**
 * Fetch users who have shared recipe data with you (owners)
 */
export async function fetchRecipeSharingOwners(): Promise<SharedUser[]> {
  const response = await fetch('/api/user/recipe-sharing/owners');
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch recipe sharing owners');
  }
  return response.json();
}
