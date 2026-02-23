#!/usr/bin/env node

/**
 * Remove a git worktree and its associated MongoDB database.
 *
 * Usage: node scripts/worktree-remove.js <branch-name>
 *
 * What it does:
 * 1. Derives the DB name from the branch name
 * 2. Drops the MongoDB database (if mongosh is available)
 * 3. Runs `git worktree remove .worktrees/<safe-name>`
 * 4. Runs `git worktree prune`
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
  console.error('Removes the worktree at .worktrees/<branch> and drops its database.');
  process.exit(1);
}

function sanitizeBranchName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

const safeName = sanitizeBranchName(branchName);
const worktreePath = resolve(projectRoot, '.worktrees', safeName);
const dbName = 'weekly-eats-' + safeName;

if (!existsSync(worktreePath)) {
  console.error('Error: No worktree found at ' + worktreePath);
  console.error('');
  try {
    const list = execSync('git worktree list', { encoding: 'utf8', cwd: projectRoot });
    console.error('Current worktrees:');
    console.error(list);
  } catch { /* ignore */ }
  process.exit(1);
}

if (resolve(worktreePath) === resolve(projectRoot)) {
  console.error('Error: Cannot remove the main worktree.');
  process.exit(1);
}

// Drop MongoDB database
const whichCmd = process.platform === 'win32' ? 'where' : 'which';
const hasMongosh = spawnSync(whichCmd, ['mongosh'], { encoding: 'utf8', shell: true }).status === 0;
if (hasMongosh) {
  console.log("Dropping database '" + dbName + "'...");
  const dropResult = spawnSync('mongosh', ['--quiet', '--eval', "db.getSiblingDB('" + dbName + "').dropDatabase()"], {
    encoding: 'utf8',
    stdio: 'pipe',
    shell: true
  });
  if (dropResult.status !== 0) {
    console.warn("Warning: Could not drop database. You may need to drop '" + dbName + "' manually.");
  } else {
    console.log('Database dropped.');
  }
} else {
  console.warn("Warning: mongosh not found. Database '" + dbName + "' was NOT dropped.");
  console.warn("To drop it manually: mongosh --eval \"db.getSiblingDB('" + dbName + "').dropDatabase()\"");
}

// Remove worktree
console.log('Removing worktree at ' + worktreePath + '...');
try {
  execSync('git worktree remove ' + JSON.stringify(worktreePath) + ' --force', { cwd: projectRoot, stdio: 'inherit' });
} catch {
  console.warn('Warning: git worktree remove failed. Cleaning up manually...');
  rmSync(worktreePath, { recursive: true, force: true });
}

execSync('git worktree prune', { cwd: projectRoot });

console.log('Worktree removed successfully.');
