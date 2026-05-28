// test/manual/__tests__/cli.test.ts
import { describe, it, expect } from 'vitest';
import { parseArgs, resolveDbSafety, resolveTarget } from '../cli.js';

describe('parseArgs', () => {
  it('parses subcommand + positional', () => {
    const r = parseArgs(['apply', 'feat/x', 'default']);
    expect(r.command).toBe('apply');
    expect(r.positional).toEqual(['feat/x', 'default']);
  });

  it('parses --manifest and --branch flags', () => {
    const r = parseArgs(['apply', '--manifest', 'demo']);
    expect(r.flags.manifest).toBe('demo');
  });

  it('parses boolean flags', () => {
    const r = parseArgs(['apply', '--json', '--dry-run', '--yes']);
    expect(r.flags.json).toBe(true);
    expect(r.flags['dry-run']).toBe(true);
    expect(r.flags.yes).toBe(true);
  });

  it('--help', () => {
    expect(parseArgs(['--help']).flags.help).toBe(true);
    expect(parseArgs(['apply', '--help']).flags.help).toBe(true);
  });
});

describe('resolveDbSafety', () => {
  it('allows worktree DB on localhost', () => {
    expect(() => resolveDbSafety('mongodb://localhost:27017/weekly-eats-feat-x', {})).not.toThrow();
  });

  it('refuses main DB without --allow-main-db', () => {
    expect(() => resolveDbSafety('mongodb://localhost:27017/weekly-eats', {})).toThrow(/main DB/i);
  });

  it('allows main DB with --allow-main-db', () => {
    expect(() =>
      resolveDbSafety('mongodb://localhost:27017/weekly-eats', { 'allow-main-db': true })
    ).not.toThrow();
  });

  it('refuses non-localhost without --allow-remote', () => {
    expect(() =>
      resolveDbSafety('mongodb://prod.atlas.example.com:27017/weekly-eats-x', {})
    ).toThrow(/remote|localhost/i);
  });

  it('refuses DB name outside allowlist', () => {
    expect(() => resolveDbSafety('mongodb://localhost:27017/something-else', {})).toThrow(
      /DB name/i
    );
  });
});

describe('resolveTarget', () => {
  it('--manifest wins over branch', () => {
    expect(
      resolveTarget({ flags: { manifest: 'demo' }, positional: ['feat/x'] }, () => 'main')
    ).toEqual({
      kind: 'manifest',
      name: 'demo',
      slot: 'default',
    });
  });

  it('--branch + slot positional', () => {
    expect(
      resolveTarget({ flags: { branch: 'feat/x' }, positional: ['admin-flow'] }, () => 'main')
    ).toEqual({
      kind: 'branch',
      name: 'feat/x',
      slot: 'admin-flow',
    });
  });

  it('positional manifest match wins over branch fallback', () => {
    // resolveTarget will look up manifest existence via a passed-in predicate
    expect(
      resolveTarget(
        { flags: {}, positional: ['demo'] },
        () => 'main',
        (name) => name === 'demo'
      )
    ).toEqual({ kind: 'manifest', name: 'demo', slot: 'default' });
  });

  it('falls back to current git branch when no positional', () => {
    expect(resolveTarget({ flags: {}, positional: [] }, () => 'feat/current')).toEqual({
      kind: 'branch',
      name: 'feat/current',
      slot: 'default',
    });
  });
});
