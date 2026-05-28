// test/manual/__tests__/validate-args.test.ts
import { describe, it, expect } from 'vitest';
import {
  validateBranch,
  validateSlot,
  sanitizeBranchForFilename,
  unsanitizeBranchFromFilename,
} from '../validate-args.js';

describe('validateBranch', () => {
  it('accepts safe branch names', () => {
    expect(() => validateBranch('main')).not.toThrow();
    expect(() => validateBranch('feat/meal-editor')).not.toThrow();
    expect(() => validateBranch('release-v1.2.3')).not.toThrow();
    expect(() => validateBranch('user/zach.rose/wip')).not.toThrow();
  });

  it('rejects empty', () => {
    expect(() => validateBranch('')).toThrow(/branch/i);
  });

  it('rejects shell metacharacters', () => {
    expect(() => validateBranch('feat;rm -rf .')).toThrow();
    expect(() => validateBranch('feat$(curl evil)')).toThrow();
    expect(() => validateBranch('feat`whoami`')).toThrow();
    expect(() => validateBranch('feat&echo')).toThrow();
    expect(() => validateBranch('feat|cat')).toThrow();
    expect(() => validateBranch('feat>out')).toThrow();
  });

  it('rejects HTML marker fragments via the charset regex', () => {
    // BRANCH_RE = [a-zA-Z0-9._/-], which excludes <, >, !.
    // So inputs containing `-->` or `<!--` hit the "disallowed characters"
    // error BEFORE the explicit marker-fragment check. The marker check is
    // defense in depth — kept for the case where the regex is ever loosened.
    expect(() => validateBranch('feat-->evil')).toThrow(/disallowed characters/i);
    expect(() => validateBranch('feat<!--')).toThrow(/disallowed characters/i);
  });

  it('rejects over-long names (>200 chars)', () => {
    expect(() => validateBranch('a'.repeat(201))).toThrow();
  });
});

describe('validateSlot', () => {
  it('accepts safe slot names', () => {
    expect(() => validateSlot('default')).not.toThrow();
    expect(() => validateSlot('admin-flow')).not.toThrow();
    expect(() => validateSlot('slot.1')).not.toThrow();
  });

  it('rejects slash (slots are flat — no path separators)', () => {
    expect(() => validateSlot('a/b')).toThrow();
  });

  it('rejects shell metachars and HTML markers via the charset regex', () => {
    // SLOT_RE = [a-zA-Z0-9._-], which excludes ;, <, >, !.
    // The marker-fragment check (in source) is defense in depth.
    expect(() => validateSlot('a;b')).toThrow(/disallowed characters/i);
    expect(() => validateSlot('a-->b')).toThrow(/disallowed characters/i);
  });

  it('rejects over-long (>64 chars)', () => {
    expect(() => validateSlot('a'.repeat(65))).toThrow();
  });
});

describe('sanitizeBranchForFilename', () => {
  it('replaces / with %2F', () => {
    expect(sanitizeBranchForFilename('feat/meal-editor')).toBe('feat%2Fmeal-editor');
  });
  it('passes through safe chars', () => {
    expect(sanitizeBranchForFilename('main')).toBe('main');
  });
});

describe('unsanitizeBranchFromFilename', () => {
  it('reverses sanitization', () => {
    expect(unsanitizeBranchFromFilename('feat%2Fmeal-editor')).toBe('feat/meal-editor');
  });
});
