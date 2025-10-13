# User Management API Tests

## Overview

This document describes the comprehensive test suite added to prevent parameter mismatch bugs and ensure API contract consistency between frontend and backend.

## Problem Statement

**The Bug**: User approval and revoke functionality was broken due to a parameter name mismatch:
- Frontend sent: `{ userId, approved: true/false }`
- Backend expected: `{ userId, isApproved: true/false }`

This caused all approval/deny/revoke requests to fail with 400 Bad Request errors because the backend validation rejected requests where `isApproved` was `undefined`.

## Solution: Comprehensive Testing

We've added three layers of testing to prevent this type of issue:

### 1. API Endpoint Tests

#### `/api/admin/users/approve` Tests
**File**: `src/app/api/admin/users/approve/__tests__/route.test.ts`

**Coverage** (14 tests):
- ✅ Authentication & Authorization (2 tests)
  - Unauthenticated requests return 401
  - Non-admin requests return 403
  
- ✅ Request Parameter Validation (5 tests)
  - Missing `userId` returns 400
  - Missing `isApproved` returns 400
  - Non-boolean `isApproved` returns 400
  - **CRITICAL**: Request with `approved` (instead of `isApproved`) returns 400
  - Valid request with correct parameters succeeds
  
- ✅ User Approval Logic (5 tests)
  - Approves user when `isApproved: true`
  - Revokes approval when `isApproved: false`
  - Returns 404 when user not found
  - Converts userId to ObjectId correctly
  - Returns proper success response format
  
- ✅ Error Handling (2 tests)
  - Database errors return 500
  - Invalid ObjectId format handled gracefully

#### `/api/admin/users/toggle-admin` Tests
**File**: `src/app/api/admin/users/toggle-admin/__tests__/route.test.ts`

**Coverage** (15 tests):
- ✅ Authentication & Authorization (2 tests)
- ✅ Request Parameter Validation (5 tests)
  - **CRITICAL**: Request with `admin` (instead of `isAdmin`) returns 400
- ✅ Admin Toggle Logic (6 tests)
  - Grants admin when `isAdmin: true`
  - Revokes admin when `isAdmin: false`
  - Returns 404 when user not found
  - Prevents self-modification
  - Converts userId to ObjectId correctly
  - Returns proper success response format
- ✅ Error Handling (2 tests)

### 2. API Contract Tests

**File**: `src/app/user-management/__tests__/api-contract.test.ts`

**Coverage** (9 tests):
These tests serve as **living documentation** of the API contracts and validate that common mistakes are avoided.

- ✅ Approve/Deny User Endpoint Contract (2 tests)
  - Documents correct parameter names: `{ userId, isApproved }`
  - Validates common mistakes: `approved`, `id`, `approve`, `user`
  
- ✅ Toggle Admin Endpoint Contract (2 tests)
  - Documents correct parameter names: `{ userId, isAdmin }`
  - Validates common mistakes: `admin`, `id`, `adminStatus`
  
- ✅ Response Format Consistency (3 tests)
  - Success response: `{ success: true }`
  - Error response: `{ error: "message" }`
  - User list response: `{ users: [...] }`
  
- ✅ Type Safety Documentation (2 tests)
  - Validates correct types for approval endpoint
  - Validates correct types for toggle-admin endpoint

### 3. Frontend Fix

**File**: `src/app/user-management/page.tsx`

**Fix Applied**:
```typescript
// Before (WRONG):
body: JSON.stringify({
  userId,
  approved,  // ❌ Parameter name mismatch
})

// After (CORRECT):
body: JSON.stringify({
  userId,
  isApproved: approved,  // ✅ Matches backend expectation
})
```

## Test Results

```
✓ src/app/api/admin/users/approve/__tests__/route.test.ts (14 tests)
✓ src/app/api/admin/users/toggle-admin/__tests__/route.test.ts (15 tests)
✓ src/app/user-management/__tests__/api-contract.test.ts (9 tests)

Test Files  3 passed (3)
Tests  38 passed (38)
```

## Running the Tests

Run all user management tests:
```bash
npm test -- src/app/api/admin/users/approve/__tests__/route.test.ts src/app/api/admin/users/toggle-admin/__tests__/route.test.ts src/app/user-management/__tests__/api-contract.test.ts
```

Run a specific test file:
```bash
npm test -- src/app/api/admin/users/approve/__tests__/route.test.ts
```

## Future Prevention

These tests will now catch:
1. ✅ Parameter name mismatches between frontend and backend
2. ✅ Missing required parameters
3. ✅ Incorrect parameter types (string vs boolean, etc.)
4. ✅ Unauthorized access attempts
5. ✅ Edge cases (invalid ObjectIds, missing users, etc.)
6. ✅ Error handling issues

## Key Takeaways

1. **Parameter names matter**: Even a small difference (`approved` vs `isApproved`) can break functionality
2. **Test the contract**: Explicitly test that frontend and backend agree on parameter names
3. **Document with tests**: Tests serve as executable documentation of API contracts
4. **Test common mistakes**: Include tests for common parameter naming variations
5. **Type safety**: Validate that parameters are the correct type, not just present

## Maintenance

When adding new admin API endpoints:
1. Create unit tests for the endpoint following the pattern in these test files
2. Add contract tests to document the expected parameters
3. Test for common parameter naming mistakes
4. Ensure both frontend and backend use the same parameter names

