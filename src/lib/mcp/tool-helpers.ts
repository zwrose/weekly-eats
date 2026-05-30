import { AUTH_ERRORS, logError } from '@/lib/errors';
import { ServiceError, ForbiddenError } from '@/lib/service-errors';

/** Shape of the `extra` argument an MCP tool handler receives from mcp-handler. */
export interface ToolExtra {
  authInfo?: {
    extra?: Record<string, unknown>;
  };
}

export interface AuthContext {
  userId: string;
  isAdmin: boolean;
}

/** Minimal MCP tool result shape (subset of the SDK's CallToolResult). */
export interface ToolResult {
  isError?: true;
  content: Array<{ type: 'text'; text: string }>;
}

/**
 * Resolves the authenticated user from the MCP auth context. verifyToken
 * (withMcpAuth) places { userId, isApproved, isAdmin } on authInfo.extra.
 */
export function getAuthContext(extra: ToolExtra): AuthContext {
  const userId = extra?.authInfo?.extra?.userId;
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new ForbiddenError(AUTH_ERRORS.UNAUTHORIZED);
  }
  const isAdmin = extra?.authInfo?.extra?.isAdmin === true;
  return { userId, isAdmin };
}

function toolText(text: string, isError?: true): ToolResult {
  return isError
    ? { isError, content: [{ type: 'text', text }] }
    : { content: [{ type: 'text', text }] };
}

/**
 * Runs a tool body, serializing the result to JSON text. Domain (ServiceError)
 * failures become actionable isError results; unexpected errors are logged and
 * returned as a generic isError so internals never leak to the agent.
 */
export async function runTool(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    const data = await fn();
    return toolText(JSON.stringify(data));
  } catch (error) {
    if (error instanceof ServiceError) {
      return toolText(error.message, true);
    }
    logError('McpTool', error);
    return toolText('Something went wrong. Please try again.', true);
  }
}
