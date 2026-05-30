import { describe, it, expect } from 'vitest';
import { rewriteWorktreeEnv } from '../../../scripts/setup-worktree.js';

describe('rewriteWorktreeEnv', () => {
  const main = ['MONGODB_URI=mongodb://localhost:27017/weekly-eats-dev', 'AUTH_SECRET=abc'].join(
    '\n'
  );

  it('preserves the MONGODB_URI line verbatim (no DB-name rewrite)', () => {
    const out = rewriteWorktreeEnv(main, { port: 3456 });
    expect(out).toContain('MONGODB_URI=mongodb://localhost:27017/weekly-eats-dev');
  });

  it('sets PORT to the worktree port', () => {
    const out = rewriteWorktreeEnv(main, { port: 3456 });
    expect(out).toMatch(/^PORT=3456$/m);
  });

  it('does not duplicate PORT when one already exists', () => {
    const out = rewriteWorktreeEnv(main + '\nPORT=9999', { port: 3456 });
    expect(out.match(/^PORT=/gm)?.length).toBe(1);
    expect(out).toMatch(/^PORT=3456$/m);
  });

  it('no longer rewrites a NEXTAUTH_URL port (trustHost handles the host)', () => {
    const out = rewriteWorktreeEnv(main + '\nNEXTAUTH_URL=http://localhost:3000', { port: 3456 });
    expect(out).toContain('NEXTAUTH_URL=http://localhost:3000'); // left verbatim, NOT rewritten to :3456
  });
});
