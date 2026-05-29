#!/usr/bin/env node

/**
 * Worktree-aware postinstall script.
 *
 * When run in the main repo: delegates to setup-database.js (existing behavior).
 * When run in a worktree: generates .env.local (deterministic port, shared DB),
 * then runs setup-database.js.
 *
 * Usage: node scripts/setup-worktree.js
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

/**
 * Detect whether we're in a worktree or the main repo.
 * Returns { isWorktree, mainWorktreePath, branchName }
 */
function detectWorktreeContext() {
  try {
    const commonDir = execSync('git rev-parse --git-common-dir', {
      encoding: 'utf8',
      cwd: projectRoot,
    }).trim();
    const gitDir = execSync('git rev-parse --git-dir', {
      encoding: 'utf8',
      cwd: projectRoot,
    }).trim();

    const resolvedCommon = resolve(projectRoot, commonDir);
    const resolvedGit = resolve(projectRoot, gitDir);
    const isWorktree = resolvedCommon !== resolvedGit;

    if (!isWorktree) {
      return { isWorktree: false, mainWorktreePath: null, branchName: null };
    }

    // The common dir is <main-repo>/.git — its parent is the main worktree
    const mainWorktreePath = resolve(resolvedCommon, '..');
    const branchName = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf8',
      cwd: projectRoot,
    }).trim();

    return { isWorktree: true, mainWorktreePath, branchName };
  } catch {
    return { isWorktree: false, mainWorktreePath: null, branchName: null };
  }
}

/**
 * Deterministic port from branch name. Hashes the name to a port in 3001-3999.
 */
function portFromBranchName(branchName) {
  const hash = createHash('sha256').update(branchName).digest();
  const num = hash.readUInt32BE(0);
  return 3001 + (num % 999);
}

/**
 * Pure env-rewrite: keep MONGODB_URI verbatim (shared DB), rewrite only the
 * NEXTAUTH_URL port and PORT. Exported for unit testing.
 */
export function rewriteWorktreeEnv(content, { port }) {
  let env = content;
  env = env.replace(/NEXTAUTH_URL=http:\/\/localhost:\d+/, 'NEXTAUTH_URL=http://localhost:' + port);
  env = env.replace(/^PORT=.*\n?/m, '');
  env = env.trimEnd() + '\nPORT=' + port + '\n';
  return env;
}

/**
 * Generate .env.local for a worktree from the main repo's .env.local.
 */
function generateEnvLocal(mainWorktreePath, branchName) {
  const mainEnvPath = resolve(mainWorktreePath, '.env.local');
  if (!existsSync(mainEnvPath)) {
    console.error('Error: Main worktree .env.local not found at ' + mainEnvPath);
    console.error('The main repo must have a .env.local for worktree setup.');
    process.exit(1);
  }
  const port = portFromBranchName(branchName);
  const envContent = rewriteWorktreeEnv(readFileSync(mainEnvPath, 'utf8'), { port });
  writeFileSync(resolve(projectRoot, '.env.local'), envContent);
  console.log(
    'Generated .env.local: port=' + port + ' (shared DB — MONGODB_URI inherited from main)'
  );
  return { port };
}

/**
 * Run setup-database.js to create indexes.
 */
function runSetupDb() {
  console.log('Running database index setup...');
  try {
    execSync('node scripts/setup-database.js', { cwd: projectRoot, stdio: 'inherit' });
  } catch {
    // setup-database.js handles its own errors gracefully
  }
}

// ---------------------------------------------------------------------------
// Main — only runs when executed directly (not when imported in tests)
// ---------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  // Skip in CI/test environments
  if (
    process.env.CI === 'true' ||
    process.env.NODE_ENV === 'test' ||
    process.env.SKIP_DB_SETUP === 'true'
  ) {
    console.log('Skipping worktree setup (CI/test/disabled).');
    process.exit(0);
  }

  const context = detectWorktreeContext();

  if (!context.isWorktree) {
    runSetupDb();
  } else {
    console.log("Worktree detected: branch '" + context.branchName + "'");
    generateEnvLocal(context.mainWorktreePath, context.branchName);
    runSetupDb();
    console.log('Worktree setup complete (shared DB).');
  }
}
