import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

// Mock dependencies
vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/mongodb', () => ({ getMongoClient: vi.fn() }));

import { getServerSession } from 'next-auth/next';
import { getMongoClient } from '@/lib/mongodb';

describe('Stores API', () => {
  const mockSession = {
    user: { id: 'user-123', email: 'test@example.com' },
  };

  const mockStores = [
    {
      _id: { toString: () => 'store-1' },
      userId: 'user-123',
      name: 'Whole Foods',
      emoji: '🥬',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const mockShoppingLists = [
    {
      _id: { toString: () => 'list-1' },
      storeId: 'store-1',
      userId: 'user-123',
      items: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (getServerSession as any).mockResolvedValue(mockSession);
  });

  describe('GET', () => {
    it('returns stores with shopping lists for authenticated user', async () => {
      const mockFind = vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(mockStores)
      });

      const mockShoppingListsFind = vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockShoppingLists)
      });

      (getMongoClient as any).mockResolvedValue({
        db: () => ({
          collection: (name: string) => {
            if (name === 'stores') {
              return { find: mockFind };
            }
            if (name === 'shoppingLists') {
              return { find: mockShoppingListsFind };
            }
          }
        })
      });

      const request = new NextRequest('http://localhost:3000/api/stores');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(1);
      expect(data[0].name).toBe('Whole Foods');
      expect(data[0].shoppingList).toBeDefined();
    });

    it('returns 401 if not authenticated', async () => {
      (getServerSession as any).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/stores');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe('POST', () => {
    it('creates a new store with shopping list', async () => {
      const mockInsertOne = vi.fn().mockResolvedValue({
        insertedId: { toString: () => 'new-store-id' }
      });

      const mockFindOne = vi.fn().mockResolvedValue(null);

      (getMongoClient as any).mockResolvedValue({
        db: () => ({
          collection: (name: string) => {
            if (name === 'stores') {
              return { 
                insertOne: mockInsertOne,
                findOne: mockFindOne
              };
            }
            if (name === 'shoppingLists') {
              return { insertOne: mockInsertOne };
            }
          }
        })
      });

      const request = new NextRequest('http://localhost:3000/api/stores', {
        method: 'POST',
        body: JSON.stringify({ name: 'Target', emoji: '🎯' })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.name).toBe('Target');
      expect(data.emoji).toBe('🎯');
      expect(mockInsertOne).toHaveBeenCalledTimes(2); // Once for store, once for shopping list
    });

    it('returns 400 if name is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/stores', {
        method: 'POST',
        body: JSON.stringify({ emoji: '🎯' })
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 if store name already exists', async () => {
      const mockFindOne = vi.fn().mockResolvedValue({
        _id: 'existing-store',
        name: 'Target'
      });

      (getMongoClient as any).mockResolvedValue({
        db: () => ({
          collection: () => ({
            findOne: mockFindOne
          })
        })
      });

      const request = new NextRequest('http://localhost:3000/api/stores', {
        method: 'POST',
        body: JSON.stringify({ name: 'Target', emoji: '🎯' })
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 401 if not authenticated', async () => {
      (getServerSession as any).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/stores', {
        method: 'POST',
        body: JSON.stringify({ name: 'Target' })
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });
});

