import { describe, it, expect, vi } from 'vitest';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '@/lib/service-errors';
import { serviceErrorResponse } from '@/lib/api-error-response';

describe('serviceErrorResponse', () => {
  it('maps ValidationError to 400 with the message', async () => {
    const res = serviceErrorResponse('Ctx', new ValidationError('Name is required'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Name is required' });
  });

  it('maps ForbiddenError to 403', async () => {
    const res = serviceErrorResponse('Ctx', new ForbiddenError('Forbidden'));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden' });
  });

  it('maps NotFoundError to 404', async () => {
    const res = serviceErrorResponse('Ctx', new NotFoundError('Recipe not found'));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Recipe not found' });
  });

  it('maps ConflictError to 409 and includes details when present', async () => {
    const res = serviceErrorResponse('Ctx', new ConflictError('Food item already exists', 'dup'));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Food item already exists', details: 'dup' });
  });

  it('maps ConflictError without details to 409 with just the error', async () => {
    const res = serviceErrorResponse('Ctx', new ConflictError('Food item already exists'));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Food item already exists' });
  });

  it('falls through unknown errors to a logged 500', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = serviceErrorResponse('Ctx', new Error('boom'));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Internal server error' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
