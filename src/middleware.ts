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

  // Approval gate: a signed-in but unapproved user may only reach the
  // pending-approval screen and the endpoints that keep it functional.
  // (/api/auth/* is already allowed by the exempt short-circuit above, so
  // sign-out keeps working.)
  const isApprovalExempt =
    pathname === '/pending-approval' ||
    pathname === '/api/user/approval-status' ||
    pathname === '/api/avatar';

  // Admins bypass approval (isAdmin and isApproved are independent flags; an
  // unapproved admin must still reach /user-management to approve users).
  if (token.isApproved !== true && token.isAdmin !== true && !isApprovalExempt) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: AUTH_ERRORS.FORBIDDEN }, { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/pending-approval';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // User is authenticated and approved (or exempt), allow access
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
