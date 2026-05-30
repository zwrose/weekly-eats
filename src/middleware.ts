import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import authConfig from '@/lib/auth.config';
import { AUTH_ERRORS } from '@/lib/errors';

const { auth } = NextAuth(authConfig);

export const middleware = auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow: home/login, auth API, Next internals, static/public assets, and the
  // MCP endpoint. /api/mcp self-authenticates via a Bearer token in withMcpAuth
  // (not a NextAuth session cookie), so this session middleware must not shadow
  // it — without the exemption, MCP clients get a 307 to the HTML login page.
  if (
    pathname === '/' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/mcp') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname === '/manifest.json' ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Not authenticated → redirect to home (login), preserving the destination.
  if (!req.auth) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    if (pathname !== '/') {
      url.searchParams.set('callbackUrl', pathname);
    }
    return NextResponse.redirect(url);
  }

  // Approval gate. /api/auth/* is already exempt above (keeps sign-out working).
  const isApprovalExempt =
    pathname === '/pending-approval' ||
    pathname === '/api/user/approval-status' ||
    pathname === '/api/avatar';

  // Admins bypass approval (isAdmin and isApproved are independent flags).
  // Fail-closed: anything other than `true` is treated as not-approved.
  if (req.auth.user?.isApproved !== true && req.auth.user?.isAdmin !== true && !isApprovalExempt) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: AUTH_ERRORS.FORBIDDEN }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/pending-approval';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
