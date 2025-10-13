export interface SharedUser {
  userId: string;
  email: string;
  name?: string;
}

export interface PendingMealPlanInvitation {
  ownerId: string;
  ownerEmail: string;
  ownerName?: string;
  invitation: {
    userId: string;
    userEmail: string;
    userName?: string;
    status: 'pending';
    invitedBy: string;
    invitedAt: Date;
  };
}

export async function inviteUserToMealPlanSharing(email: string): Promise<void> {
  const response = await fetch('/api/user/meal-plan-sharing/invite', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to invite user');
  }
}

export async function respondToMealPlanSharingInvitation(
  userId: string,
  action: 'accept' | 'reject'
): Promise<void> {
  const response = await fetch(`/api/user/meal-plan-sharing/invitations/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Failed to ${action} invitation`);
  }
}

export async function removeUserFromMealPlanSharing(userId: string): Promise<void> {
  const response = await fetch(`/api/user/meal-plan-sharing/invitations/${userId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to remove user from meal plan sharing');
  }
}

export async function fetchPendingMealPlanSharingInvitations(): Promise<PendingMealPlanInvitation[]> {
  const response = await fetch('/api/user/meal-plan-sharing/invitations');
  if (!response.ok) {
    throw new Error('Failed to fetch pending meal plan sharing invitations');
  }
  return response.json();
}

export async function fetchSharedMealPlanUsers(): Promise<SharedUser[]> {
  const response = await fetch('/api/user/meal-plan-sharing/shared-users');
  if (!response.ok) {
    throw new Error('Failed to fetch shared meal plan users');
  }
  return response.json();
}

export async function fetchMealPlanOwners(): Promise<SharedUser[]> {
  const response = await fetch('/api/user/meal-plan-sharing/owners');
  if (!response.ok) {
    throw new Error('Failed to fetch meal plan owners');
  }
  return response.json();
}

