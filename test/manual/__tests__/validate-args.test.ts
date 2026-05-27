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

  it('rejects HTML marker fragments', () => {
    expect(() => validateBranch('feat-->evil')).toThrow();
    expect(() => validateBranch('feat<!--')).toThrow();
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

  it('rejects shell metachars and HTML markers', () => {
    expect(() => validateSlot('a;b')).toThrow();
    expect(() => validateSlot('a-->b')).toThrow();
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
