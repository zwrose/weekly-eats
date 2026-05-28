import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { AUTH_ERRORS } from '@/lib/errors';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to:
  // - Home page (login page)
  // - Auth API routes
  // - Static files and Next.js internals
  // - Public assets (manifest, icons, images)
  if (
    pathname === '/' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname === '/manifest.json' ||
    pathname.includes('.') // files with extensions (favicon, images, etc.)
  ) {
    return NextResponse.next();
  }

  // Check if user is authenticated
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // If not authenticated, redirect to home page (login)
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    // Preserve the original URL as a callback parameter if needed
    if (pathname !== '/') {
      url.searchParams.set('callbackUrl', pathname);
    }
    return NextResponse.redirect(url);
  }

  // Interim server-side approval gate (beta runs against the shared prod DB).
  // Admins are exempt; mirrors the client-side use-approval-status logic.
  const isApproved = token.isApproved === true || token.isAdmin === true;
  if (!isApproved) {
    // Keep the approval poll + the pending page reachable so an approved-mid-session
    // user can still be un-gated by the client hook.
    if (pathname === '/pending-approval' || pathname === '/api/user/approval-status') {
      return NextResponse.next();
    }
    // Don't redirect API calls to an HTML page — return a JSON 403.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: AUTH_ERRORS.FORBIDDEN }, { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/pending-approval';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // User is authenticated and approved, allow access
  return NextResponse.next();
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (manifest.json, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
