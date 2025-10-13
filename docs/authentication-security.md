# Authentication and Security

## Overview

This application now has comprehensive authentication protection at both the route and API endpoint levels. All pages and API endpoints require users to be logged in before they can access any functionality.

## Middleware Protection

### Location
The middleware is implemented in `/src/middleware.ts` and runs on every request to the application.

### Protected Routes
All routes are protected by default **except**:
- `/` - Home page (login page)
- `/api/auth/*` - NextAuth authentication endpoints
- `/_next/*` - Next.js internal files
- `/static/*` - Static assets
- `/manifest.json` - PWA manifest
- Files with extensions (`.svg`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.ico`)

### Behavior
When a user tries to access any protected route without being logged in:
1. The middleware checks for a valid authentication token using NextAuth's `getToken` function
2. If no valid token is found, the user is redirected to the home page (`/`)
3. The original URL is preserved in the `callbackUrl` query parameter for future redirection after login

### How It Works
```typescript
// Check if user is authenticated
const token = await getToken({ 
  req: request,
  secret: process.env.NEXTAUTH_SECRET 
});

// If not authenticated, redirect to home page (login)
if (!token) {
  const url = request.nextUrl.clone();
  url.pathname = '/';
  if (pathname !== '/') {
    url.searchParams.set('callbackUrl', pathname);
  }
  return NextResponse.redirect(url);
}
```

## API Endpoint Protection

### Authentication Checks
All API endpoints verify authentication using `getServerSession` from NextAuth:

```typescript
const session = await getServerSession(authOptions);
if (!session?.user?.id) {
  return NextResponse.json({ error: AUTH_ERRORS.UNAUTHORIZED }, { status: 401 });
}
```

### Protected Endpoints
All API endpoints under `/api/*` (except `/api/auth/*`) require authentication:

- `/api/admin/*` - Admin-only endpoints (also check for admin status)
- `/api/food-items/*` - Food items management
- `/api/meal-plans/*` - Meal planning
- `/api/pantry/*` - Pantry management
- `/api/recipes/*` - Recipe management
- `/api/shopping-lists/*` - Shopping lists
- `/api/stores/*` - Store management and invitations
- `/api/user/*` - User settings and status

### Authorization Levels

#### 1. Authenticated Users
All logged-in users can access:
- Their own data (recipes, meal plans, pantry items, etc.)
- Global/shared resources (global recipes, food items)
- Store invitations they've received

#### 2. Approved Users
Users must be approved by an admin to access most functionality:
- Unapproved users are redirected to `/pending-approval`
- The approval status is checked in the NextAuth session callback
- Real-time approval status updates via Server-Sent Events (SSE)

#### 3. Admin Users
Admins have additional access to:
- User management (`/api/admin/users`)
- Approve/deny user registrations
- Grant/revoke admin privileges
- View pending user approvals

## Client-Side Protection

### Session Management
Pages use NextAuth's `useSession()` hook to check authentication status:

```typescript
const { data: session, status } = useSession();

// Redirect if not authenticated
useEffect(() => {
  if (status === "unauthenticated") {
    router.push('/');
  }
}, [status, router]);
```

### Layout Protection
Pages are wrapped in `AuthenticatedLayout` which:
1. Checks user session
2. Verifies approval status
3. Redirects to appropriate pages based on status
4. Provides consistent header and navigation

### Real-Time Approval Status
The app uses Server-Sent Events (SSE) to monitor approval status changes:
- Connection established via `/api/user/approval-status/stream`
- Polls database every 5 seconds for changes
- Automatically redirects when approval status changes
- Updates session without requiring re-login

## Security Best Practices

### 1. Defense in Depth
- **Middleware** blocks unauthenticated requests at the edge
- **API endpoints** verify authentication on every request
- **Client components** check session status for UX
- No single point of failure

### 2. Session Security
- JWT-based sessions (configured in NextAuth)
- Secure session tokens
- NEXTAUTH_SECRET environment variable required
- Session data includes user ID, email, admin status, and approval status

### 3. Authorization Patterns
- **User ownership**: Users can only access their own data
- **Admin checks**: Admin-only endpoints verify admin status
- **Store collaboration**: Users can access stores they own or have been invited to

### 4. Error Handling
All API endpoints:
- Return appropriate HTTP status codes (401, 403, 404, 500)
- Use consistent error messages from `/lib/errors.ts`
- Log errors for debugging without exposing sensitive information
- Never expose stack traces or internal errors to clients

## Environment Variables Required

```env
NEXTAUTH_SECRET=your-secret-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
MONGODB_URI=your-mongodb-connection-string
```

## Testing Authentication

### Manual Testing
1. Try accessing `/meal-plans` without being logged in → should redirect to `/`
2. Try calling `/api/recipes` without auth token → should return 401
3. Log in with valid Google account → should access app
4. Log in as unapproved user → should see pending approval page
5. Log in as approved user → should access all features
6. Log in as admin → should access admin panel

### Automated Testing
Authentication is tested in:
- API route tests (`__tests__/route.test.ts`)
- Component tests (`__tests__/*.test.tsx`)
- Integration tests mock `getServerSession` for different scenarios

## Troubleshooting

### Common Issues

1. **Infinite redirect loop**
   - Check that home page (`/`) is not in the protected routes
   - Verify NEXTAUTH_SECRET is set correctly

2. **401 errors on API calls**
   - Ensure user is logged in
   - Check session is properly initialized
   - Verify JWT token is being sent with requests

3. **Middleware not running**
   - Verify `/src/middleware.ts` exists
   - Check Next.js config allows middleware
   - Review matcher configuration in middleware

## Future Enhancements

- [ ] Rate limiting on API endpoints
- [ ] IP-based access controls for admin panel
- [ ] Two-factor authentication
- [ ] Audit logging for sensitive operations
- [ ] Session timeout warnings
- [ ] CSRF protection for state-changing operations

