import { describe, it, expect, vi } from 'vitest';
import { getAuthContext, runTool } from '@/lib/mcp/tool-helpers';
import { ValidationError, ForbiddenError } from '@/lib/service-errors';

describe('getAuthContext', () => {
  it('extracts userId and isAdmin from extra.authInfo.extra', () => {
    const ctx = getAuthContext({
      authInfo: { extra: { userId: 'u1', isAdmin: true } },
    });
    expect(ctx).toEqual({ userId: 'u1', isAdmin: true });
  });

  it('defaults isAdmin to false when absent', () => {
    const ctx = getAuthContext({ authInfo: { extra: { userId: 'u1' } } });
    expect(ctx).toEqual({ userId: 'u1', isAdmin: false });
  });

  it('throws ForbiddenError when there is no userId', () => {
    expect(() => getAuthContext({ authInfo: { extra: {} } })).toThrow(ForbiddenError);
    expect(() => getAuthContext({})).toThrow(ForbiddenError);
  });
});

describe('runTool', () => {
  it('wraps a successful result as JSON text content', async () => {
    const res = await runTool(async () => ({ ok: true, n: 2 }));
    expect(res.isError).toBeUndefined();
    expect(res.content[0]).toEqual({ type: 'text', text: JSON.stringify({ ok: true, n: 2 }) });
  });

  it('maps a domain error to an isError result carrying the message', async () => {
    const res = await runTool(async () => {
      throw new ValidationError('Name is required');
    });
    expect(res.isError).toBe(true);
    expect(res.content[0]).toEqual({ type: 'text', text: 'Name is required' });
  });

  it('logs and returns a generic isError for an unexpected error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await runTool(async () => {
      throw new Error('kaboom');
    });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe('Something went wrong. Please try again.');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
