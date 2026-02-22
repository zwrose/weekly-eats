import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next-auth session
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}));

// Mock authOptions
vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

// Mock MongoDB
const findOneMock = vi.fn();
const updateOneMock = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  getMongoClient: vi.fn(async () => ({
    db: () => ({
      collection: (name: string) => {
        if (name === 'users') {
          return {
            findOne: findOneMock,
            updateOne: updateOneMock,
          };
        }
        return {};
      },
    }),
  })),
}));

// Mock errors
vi.mock('@/lib/errors', () => ({
  AUTH_ERRORS: {
    UNAUTHORIZED: 'Unauthorized',
  },
  API_ERRORS: {
    INTERNAL_SERVER_ERROR: 'Internal server error',
  },
  RECIPE_SHARING_ERRORS: {
    INVALID_EMAIL: 'Valid email address is required',
    INVALID_SHARING_TYPES: 'Sharing types must be an array with at least one of: tags, ratings',
    SELF_INVITE: 'Cannot share recipe data with yourself',
    USER_NOT_FOUND: 'User not found. They need to register first.',
  },
  logError: vi.fn(),
}));

// Convenient access to mocked imports
const { getServerSession } = await import('next-auth/next');
const { ObjectId } = await import('mongodb');

// Import the route module after mocks are set up
const routes = await import('../route');

const makeRequest = (body: unknown) =>
  ({
    json: async () => body,
  }) as any;

beforeEach(() => {
  vi.restoreAllMocks();
  (getServerSession as any).mockReset();
  findOneMock.mockReset();
  updateOneMock.mockReset();
});

describe('api/user/recipe-sharing/invite route', () => {
  const mockSession = {
    user: {
      id: 'user-1',
      email: 'user1@example.com',
    },
  };

  const mockInvitedUser = {
    _id: ObjectId.createFromHexString('507f1f77bcf86cd799439011'),
    email: 'user2@example.com',
    name: 'User Two',
  };

  const mockCurrentUser = {
    _id: ObjectId.createFromHexString('507f1f77bcf86cd799439012'),
    email: 'user1@example.com',
    name: 'User One',
    settings: {
      recipeSharing: {
        invitations: [],
      },
    },
  };

  it('POST returns 401 when unauthenticated', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await routes.POST(
      makeRequest({ email: 'user2@example.com', sharingTypes: ['tags'] })
    );
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('POST returns 400 for invalid email', async () => {
    (getServerSession as any).mockResolvedValueOnce(mockSession);
    const res = await routes.POST(makeRequest({ email: 'invalid-email', sharingTypes: ['tags'] }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Valid email address is required');
  });

  it('POST returns 400 for empty sharing types', async () => {
    (getServerSession as any).mockResolvedValueOnce(mockSession);
    const res = await routes.POST(makeRequest({ email: 'user2@example.com', sharingTypes: [] }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Sharing types must be an array');
  });

  it('POST returns 400 for invalid sharing types', async () => {
    (getServerSession as any).mockResolvedValueOnce(mockSession);
    const res = await routes.POST(
      makeRequest({ email: 'user2@example.com', sharingTypes: ['invalid'] })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Sharing types must be an array');
  });

  it('POST returns 400 for self-invitation', async () => {
    (getServerSession as any).mockResolvedValueOnce(mockSession);
    const res = await routes.POST(
      makeRequest({ email: 'user1@example.com', sharingTypes: ['tags'] })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Cannot share recipe data with yourself');
  });

  it('POST returns 404 when user not found', async () => {
    (getServerSession as any).mockResolvedValueOnce(mockSession);
    findOneMock.mockResolvedValueOnce(null); // User not found
    const res = await routes.POST(
      makeRequest({ email: 'nonexistent@example.com', sharingTypes: ['tags'] })
    );
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain('User not found');
  });

  it('POST successfully creates invitation for tags', async () => {
    (getServerSession as any).mockResolvedValueOnce(mockSession);
    findOneMock
      .mockResolvedValueOnce(mockInvitedUser) // Find invited user
      .mockResolvedValueOnce(mockCurrentUser); // Find current user
    updateOneMock.mockResolvedValueOnce({ acknowledged: true });

    const res = await routes.POST(
      makeRequest({ email: 'user2@example.com', sharingTypes: ['tags'] })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.invitation).toMatchObject({
      userId: mockInvitedUser._id.toString(),
      userEmail: 'user2@example.com',
      userName: 'User Two',
      status: 'pending',
      invitedBy: 'user-1',
      sharingTypes: ['tags'],
    });
    // invitedAt should be a Date (can be string if serialized)
    expect(data.invitation.invitedAt).toBeDefined();
  });

  it('POST successfully creates invitation for ratings', async () => {
    (getServerSession as any).mockResolvedValueOnce(mockSession);
    findOneMock.mockResolvedValueOnce(mockInvitedUser).mockResolvedValueOnce(mockCurrentUser);
    updateOneMock.mockResolvedValueOnce({ acknowledged: true });

    const res = await routes.POST(
      makeRequest({ email: 'user2@example.com', sharingTypes: ['ratings'] })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.invitation.sharingTypes).toEqual(['ratings']);
  });

  it('POST successfully creates invitation for both tags and ratings', async () => {
    (getServerSession as any).mockResolvedValueOnce(mockSession);
    findOneMock.mockResolvedValueOnce(mockInvitedUser).mockResolvedValueOnce(mockCurrentUser);
    updateOneMock.mockResolvedValueOnce({ acknowledged: true });

    const res = await routes.POST(
      makeRequest({ email: 'user2@example.com', sharingTypes: ['tags', 'ratings'] })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.invitation.sharingTypes).toEqual(['tags', 'ratings']);
  });

  it('POST replaces existing invitation for same user', async () => {
    (getServerSession as any).mockResolvedValueOnce(mockSession);
    const existingUser = {
      ...mockCurrentUser,
      settings: {
        recipeSharing: {
          invitations: [
            {
              userId: mockInvitedUser._id.toString(),
              userEmail: 'user2@example.com',
              status: 'pending',
              sharingTypes: ['tags'],
            },
          ],
        },
      },
    };

    findOneMock.mockResolvedValueOnce(mockInvitedUser).mockResolvedValueOnce(existingUser);
    updateOneMock.mockResolvedValueOnce({ acknowledged: true });

    const res = await routes.POST(
      makeRequest({ email: 'user2@example.com', sharingTypes: ['ratings'] })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.invitation.sharingTypes).toEqual(['ratings']);

    // Verify old invitation was replaced (only one invitation should exist)
    expect(updateOneMock).toHaveBeenCalledWith(
      { email: 'user1@example.com' },
      expect.objectContaining({
        $set: {
          'settings.recipeSharing.invitations': expect.arrayContaining([
            expect.objectContaining({
              userId: mockInvitedUser._id.toString(),
              sharingTypes: ['ratings'],
            }),
          ]),
        },
      })
    );
  });
});
