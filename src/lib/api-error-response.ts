import { NextResponse } from 'next/server';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '@/lib/service-errors';
import { API_ERRORS, logError } from '@/lib/errors';

/**
 * Maps a caught service-layer error to a NextResponse with the matching HTTP
 * status. Unknown errors are logged and returned as a generic 500, preserving
 * the existing route behavior. HTTP-only — never import this into a service.
 */
export function serviceErrorResponse(context: string, error: unknown): NextResponse {
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ConflictError) {
    const body = error.details
      ? { error: error.message, details: error.details }
      : { error: error.message };
    return NextResponse.json(body, { status: 409 });
  }
  logError(context, error);
  return NextResponse.json({ error: API_ERRORS.INTERNAL_SERVER_ERROR }, { status: 500 });
}
