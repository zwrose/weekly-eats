// src/lib/mcp/oauth/types.ts
import type { ObjectId } from 'mongodb';

export interface McpClientDoc {
  _id?: ObjectId;
  clientId: string;
  clientName: string;
  redirectUris: string[];
  createdAt: number;
  lastUsedAt: Date;
}

export interface McpAuthStateDoc {
  _id?: ObjectId;
  hashedState: string; // SHA-256 of the raw nonce
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  resource: string;
  scope: string;
  clientState: string | null; // the OAuth client's own `state`, echoed back verbatim
  expiresAt: Date;
}

export interface McpAuthCodeDoc {
  _id?: ObjectId;
  hashedCode: string; // SHA-256 of the raw code
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  resource: string;
  userId: string;
  scope: string;
  expiresAt: Date;
}

export type McpTokenType = 'access' | 'refresh';

export interface McpTokenDoc {
  _id?: ObjectId;
  hashedToken: string; // SHA-256 of the raw token
  tokenType: McpTokenType;
  userId: string;
  clientId: string;
  resource: string;
  scope: string;
  /** Shared across an entire grant lineage (= SHA-256 of the originating auth code). */
  grantId: string;
  expiresAt: Date;
  revokedAt: number | null;
  /** Refresh tokens only: hash of the token that replaced this one (rotation). */
  replacedBy: string | null;
}

export interface McpConsentDoc {
  _id?: ObjectId;
  userId: string;
  clientId: string;
  scope: string;
  grantedAt: number;
}

export interface McpRateLimitDoc {
  _id?: ObjectId;
  key: string; // e.g. `register:<ip>`
  count: number;
  windowStart: number;
  expiresAt: Date;
}
