// test/manual/__tests__/pr-comment.test.ts
// @vitest-environment node
// Pinned to Node env so vi.mock('node:child_process', ...) intercepts the named
// `execFile` import cleanly. Under jsdom, vitest's CJS↔ESM interop for built-in
// node modules drops the named export when only a partial mock is provided.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const exec = vi.fn();
vi.mock('node:child_process', () => ({
  execFile: (cmd: string, args: string[], opts: any, cb: any) => exec(cmd, args, opts, cb),
}));

import {
  buildMarker,
  findPrAndComment,
  postOrEditPrComment,
  findExistingComment,
  sanitizeBlockSummary,
} from '../pr-comment.js';

beforeEach(() => exec.mockReset());

describe('buildMarker', () => {
  it('builds open/close marker pair', () => {
    expect(buildMarker('feat/x', 'default')).toEqual({
      open: '<!-- manual-testing-plan: feat/x :: default -->',
      close: '<!-- /manual-testing-plan -->',
    });
  });

  it('throws on branch with -->', () => {
    expect(() => buildMarker('feat-->evil', 'default')).toThrow();
  });
});

describe('findExistingComment', () => {
  it('returns the comment id when marker found in body', async () => {
    exec.mockImplementation((_cmd, _args, _opts, cb) => {
      if (typeof cb !== 'function') return;
      cb(null, {
        stdout: JSON.stringify([
          { id: 1, body: 'unrelated' },
          { id: 42, body: 'foo\n<!-- manual-testing-plan: feat/x :: default -->\nbar' },
        ]),
        stderr: '',
      });
    });
    const marker = buildMarker('feat/x', 'default');
    const id = await findExistingComment(99, marker);
    expect(id).toBe(42);
  });

  it('returns null when no marker matches', async () => {
    exec.mockImplementation((_cmd, _args, _opts, cb) => {
      if (typeof cb !== 'function') return;
      cb(null, { stdout: '[]', stderr: '' });
    });
    const marker = buildMarker('feat/x', 'default');
    expect(await findExistingComment(99, marker)).toBeNull();
  });
});

describe('postOrEditPrComment', () => {
  it('POSTs when no existing comment', async () => {
    let captured: any = null;
    exec.mockImplementation((cmd, args, _opts, cb) => {
      captured = { cmd, args };
      if (typeof cb !== 'function') return;
      cb(null, { stdout: JSON.stringify({ id: 555 }), stderr: '' });
    });
    const r = await postOrEditPrComment(42, 'body text', null);
    expect(r.commentId).toBe(555);
    expect(captured.args.some((a: string) => a.includes('comments'))).toBe(true);
    expect(captured.args).not.toContain('--method');
  });

  it('PATCHes when existing comment id given', async () => {
    let captured: any = null;
    exec.mockImplementation((cmd, args, _opts, cb) => {
      captured = { cmd, args };
      if (typeof cb !== 'function') return;
      cb(null, { stdout: '', stderr: '' });
    });
    const r = await postOrEditPrComment(42, 'body text', 999);
    expect(r.commentId).toBe(999);
    expect(captured.args).toContain('--method');
    expect(captured.args).toContain('PATCH');
  });
});

describe('sanitizeBlockSummary', () => {
  it('passes through clean ASCII text', () => {
    expect(sanitizeBlockSummary('5 recipes')).toBe('5 recipes');
  });
  it('rejects too-long text', () => {
    expect(() => sanitizeBlockSummary('a'.repeat(121))).toThrow(/too long/);
  });
  it('rejects non-ASCII', () => {
    expect(() => sanitizeBlockSummary('é')).toThrow(/ASCII|control/i);
  });
  it('rejects backticks', () => {
    expect(() => sanitizeBlockSummary('hello `world`')).toThrow(/backtick/);
  });
});
