#!/usr/bin/env node

/**
 * Remove a git worktree and purge its seeded data from the shared dev DB.
 *
 * Usage: node scripts/worktree-remove.js <branch-name>
 *
 * What it does:
 * 1. Best-effort purge of this branch's seeded data from the shared dev DB
 *    (deletes only docs tagged with `_seedManifestId` starting `branch::`)
 *    Never drops a database.
 * 2. Runs `git worktree remove .worktrees/<safe-name>`
 * 3. Runs `git worktree prune`
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const branchName = process.argv[2];

if (!branchName) {
  console.error('Usage: node scripts/worktree-remove.js <branch-name>');
  console.error('');
  console.error(
    'Removes the worktree at .worktrees/<branch> and purges its seeded data from the shared dev DB.'
  );
  process.exit(1);
}

function sanitizeBranchName(name) {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const safeName = sanitizeBranchName(branchName);
const worktreePath = resolve(projectRoot, '.worktrees', safeName);

if (!existsSync(worktreePath)) {
  console.error('Error: No worktree found at ' + worktreePath);
  console.error('');
  try {
    const list = execSync('git worktree list', { encoding: 'utf8', cwd: projectRoot });
    console.error('Current worktrees:');
    console.error(list);
  } catch {
    /* ignore */
  }
  process.exit(1);
}

if (resolve(worktreePath) === resolve(projectRoot)) {
  console.error('Error: Cannot remove the main worktree.');
  process.exit(1);
}

// Best-effort: purge this branch's seeded data from the SHARED dev DB before
// removing the worktree. Never drops a database. Safe if it fails (the orphan
// sweep is the backstop). Runs from the worktree dir so .env.local resolves.
const SAFE_BRANCH_RE = /^[a-zA-Z0-9._/-]+$/;
if (!SAFE_BRANCH_RE.test(branchName)) {
  console.warn(
    "Warning: branch name '" + branchName + "' contains unexpected characters — skipping purge."
  );
  console.warn(
    'Seeded data is shared — run `npm run test:manual:clean -- --orphans` later to sweep.'
  );
} else {
  console.log("Purging seeded data for branch '" + branchName + "' (shared DB)...");
  const purge = spawnSync(
    'npx',
    ['tsx', 'test/manual/cli.ts', 'clean', '--manifest-id', branchName],
    { cwd: worktreePath, encoding: 'utf8', stdio: 'inherit', shell: process.platform === 'win32' }
  );
  if (purge.status !== 0) {
    console.warn("Warning: could not purge seeded data for '" + branchName + "'.");
    console.warn(
      'Seeded data is shared — run `npm run test:manual:clean -- --orphans` later to sweep.'
    );
  }
}

// Remove worktree
console.log('Removing worktree at ' + worktreePath + '...');
try {
  execSync('git worktree remove ' + JSON.stringify(worktreePath) + ' --force', {
    cwd: projectRoot,
    stdio: 'inherit',
  });
} catch {
  console.warn('Warning: git worktree remove failed. Cleaning up manually...');
  rmSync(worktreePath, { recursive: true, force: true });
}

execSync('git worktree prune', { cwd: projectRoot });

console.log('Worktree removed successfully.');
