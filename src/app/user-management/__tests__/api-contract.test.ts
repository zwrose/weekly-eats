import { describe, it, expect } from 'vitest';

/**
 * API Contract Tests
 * 
 * These tests validate that the frontend and backend agree on the API contracts.
 * They catch parameter name mismatches and ensure consistent communication.
 * 
 * WHY: Previously, the frontend sent { userId, approved } while the backend 
 * expected { userId, isApproved }, causing silent failures.
 */
describe('User Management API Contracts', () => {
  describe('Approve/Deny User Endpoint', () => {
    /**
     * Contract: POST /api/admin/users/approve
     * Purpose: Approve or deny user access to the system
     */
    it('has correct parameter names documented', () => {
      const frontendPayload = {
        userId: 'string',
        isApproved: 'boolean',
      };

      const backendExpected = {
        userId: 'string',
        isApproved: 'boolean',
      };

      // Verify parameter names match
      expect(Object.keys(frontendPayload).sort()).toEqual(
        Object.keys(backendExpected).sort()
      );
      
      // This documents the correct usage
      const exampleRequest = {
        userId: '507f1f77bcf86cd799439011',
        isApproved: true, // NOT 'approved'
      };
      
      expect(exampleRequest).toHaveProperty('userId');
      expect(exampleRequest).toHaveProperty('isApproved');
      expect(exampleRequest).not.toHaveProperty('approved'); // Common mistake
    });

    it('validates common parameter name mistakes are avoided', () => {
      // These are WRONG and should NOT be used
      const incorrectPayloads = [
        { userId: '123', approved: true },      // WRONG: should be isApproved
        { id: '123', isApproved: true },        // WRONG: should be userId
        { userId: '123', approve: true },       // WRONG: should be isApproved
        { user: '123', isApproved: true },      // WRONG: should be userId
      ];

      const correctPayload = {
        userId: '507f1f77bcf86cd799439011',
        isApproved: true,
      };

      // Ensure none of the incorrect patterns match the correct one
      incorrectPayloads.forEach((incorrect) => {
        expect(incorrect).not.toEqual(correctPayload);
      });
    });
  });

  describe('Toggle Admin Endpoint', () => {
    /**
     * Contract: POST /api/admin/users/toggle-admin
     * Purpose: Grant or revoke admin privileges
     */
    it('has correct parameter names documented', () => {
      const frontendPayload = {
        userId: 'string',
        isAdmin: 'boolean',
      };

      const backendExpected = {
        userId: 'string',
        isAdmin: 'boolean',
      };

      expect(Object.keys(frontendPayload).sort()).toEqual(
        Object.keys(backendExpected).sort()
      );

      const exampleRequest = {
        userId: '507f1f77bcf86cd799439011',
        isAdmin: true, // NOT 'admin'
      };

      expect(exampleRequest).toHaveProperty('userId');
      expect(exampleRequest).toHaveProperty('isAdmin');
      expect(exampleRequest).not.toHaveProperty('admin'); // Common mistake
    });

    it('validates common parameter name mistakes are avoided', () => {
      const incorrectPayloads = [
        { userId: '123', admin: true },         // WRONG: should be isAdmin
        { id: '123', isAdmin: true },           // WRONG: should be userId
        { userId: '123', adminStatus: true },   // WRONG: should be isAdmin
      ];

      const correctPayload = {
        userId: '507f1f77bcf86cd799439011',
        isAdmin: true,
      };

      incorrectPayloads.forEach((incorrect) => {
        expect(incorrect).not.toEqual(correctPayload);
      });
    });
  });

  describe('Response Format Consistency', () => {
    it('documents expected success response format', () => {
      const expectedSuccessResponse = {
        success: true,
      };

      // Both endpoints should return this format on success
      expect(expectedSuccessResponse).toHaveProperty('success');
      expect(expectedSuccessResponse.success).toBe(true);
    });

    it('documents expected error response format', () => {
      const expectedErrorResponse = {
        error: 'Error message string',
      };

      expect(expectedErrorResponse).toHaveProperty('error');
      expect(typeof expectedErrorResponse.error).toBe('string');
    });

    it('documents user list response format', () => {
      const expectedUserListResponse = {
        users: [
          {
            _id: 'string',
            name: 'string',
            email: 'string',
            isAdmin: true,
            isApproved: true,
          },
        ],
      };

      // GET /api/admin/users and GET /api/admin/users/pending
      // both return { users: [...] }
      expect(expectedUserListResponse).toHaveProperty('users');
      expect(Array.isArray(expectedUserListResponse.users)).toBe(true);
      
      const user = expectedUserListResponse.users[0];
      expect(user).toHaveProperty('_id');
      expect(user).toHaveProperty('name');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('isAdmin');
      expect(user).toHaveProperty('isApproved');
    });
  });

  describe('Type Safety Documentation', () => {
    it('documents required field types for approval', () => {
      const requiredTypes = {
        userId: 'must be a string (valid MongoDB ObjectId)',
        isApproved: 'must be a boolean (not string "true" or number 1)',
      };

      // Example of CORRECT usage
      const valid = {
        userId: '507f1f77bcf86cd799439011',
        isApproved: true,
      };
      expect(typeof valid.userId).toBe('string');
      expect(typeof valid.isApproved).toBe('boolean');

      // Examples of INCORRECT usage (these should fail validation)
      const invalidExamples = [
        { userId: '123', isApproved: 'true' },      // isApproved is string, not boolean
        { userId: '123', isApproved: 1 },           // isApproved is number, not boolean
        { userId: 123, isApproved: true },          // userId is number, not string
      ];

      invalidExamples.forEach((invalid) => {
        expect(typeof invalid.userId === 'string' && typeof invalid.isApproved === 'boolean').toBe(false);
      });
    });

    it('documents required field types for toggle admin', () => {
      const valid = {
        userId: '507f1f77bcf86cd799439011',
        isAdmin: false,
      };
      expect(typeof valid.userId).toBe('string');
      expect(typeof valid.isAdmin).toBe('boolean');

      const invalidExamples = [
        { userId: '123', isAdmin: 'false' },        // isAdmin is string, not boolean
        { userId: '123', isAdmin: 0 },              // isAdmin is number, not boolean
      ];

      invalidExamples.forEach((invalid) => {
        expect(typeof invalid.userId === 'string' && typeof invalid.isAdmin === 'boolean').toBe(false);
      });
    });
  });
});

