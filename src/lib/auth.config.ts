import type { NextAuthConfig } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import type { Session } from 'next-auth';
import Google from 'next-auth/providers/google';

// Preview-origin allowlist (defense-in-depth beyond the signed OAuth state).
// Match on the EXTRACTED origin, never the raw url — see the redirect callback.
const PROD_ORIGIN = 'https://weekly-eats.vercel.app';
const PREVIEW_ORIGIN = /^https:\/\/weekly-eats-[a-z0-9-]+-zach-roses-projects\.vercel\.app$/;

function isAllowedOrigin(origin: string, baseUrl: string): boolean {
  return origin === baseUrl || origin === PROD_ORIGIN || PREVIEW_ORIGIN.test(origin);
}

// Edge-safe config shared by auth.ts (full, Node runtime) and middleware.ts.
// No adapter, no MongoDB import — this module is bundled for the Edge runtime.
const authConfig = {
  providers: [Google], // auto-infers AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
  trustHost: true,
  redirectProxyUrl: process.env.AUTH_REDIRECT_PROXY_URL,
  session: { strategy: 'jwt' },
  callbacks: {
    session({ session, token }: { session: Session; token: JWT }) {
      // Forward cached token claims to the session — no DB query.
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      session.user.isAdmin = token.isAdmin === true;
      session.user.isApproved = token.isApproved === true;
      return session;
    },
    redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      const origin = new URL(url).origin;
      if (isAllowedOrigin(origin, baseUrl)) return url;
      return baseUrl;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
