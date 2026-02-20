#!/usr/bin/env node

/**
 * Worktree-aware postinstall script.
 *
 * When run in the main repo: delegates to setup-database.js (existing behavior).
 * When run in a worktree: generates .env.local (deterministic port + unique DB),
 * clones the main DB, then runs setup-database.js.
 *
 * Usage: node scripts/setup-worktree.js
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Skip in CI/test environments
if (process.env.CI === 'true' || process.env.NODE_ENV === 'test' || process.env.SKIP_DB_SETUP === 'true') {
  console.log('Skipping worktree setup (CI/test/disabled).');
  process.exit(0);
}

/**
 * Detect whether we're in a worktree or the main repo.
 * Returns { isWorktree, mainWorktreePath, branchName }
 */
function detectWorktreeContext() {
  try {
    const commonDir = execSync('git rev-parse --git-common-dir', { encoding: 'utf8', cwd: projectRoot }).trim();
    const gitDir = execSync('git rev-parse --git-dir', { encoding: 'utf8', cwd: projectRoot }).trim();

    const resolvedCommon = resolve(projectRoot, commonDir);
    const resolvedGit = resolve(projectRoot, gitDir);
    const isWorktree = resolvedCommon !== resolvedGit;

    if (!isWorktree) {
      return { isWorktree: false, mainWorktreePath: null, branchName: null };
    }

    // The common dir is <main-repo>/.git — its parent is the main worktree
    const mainWorktreePath = resolve(resolvedCommon, '..');
    const branchName = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8', cwd: projectRoot }).trim();

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
 * Sanitize branch name for use as a database name suffix.
 */
function sanitizeBranchName(branchName) {
  return branchName.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
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
  const safeName = sanitizeBranchName(branchName);
  const dbName = 'weekly-eats-' + safeName;

  let envContent = readFileSync(mainEnvPath, 'utf8');

  // Replace MONGODB_URI database name
  envContent = envContent.replace(
    /MONGODB_URI=mongodb:\/\/localhost:27017\/[^\s]*/,
    'MONGODB_URI=mongodb://localhost:27017/' + dbName
  );

  // Replace NEXTAUTH_URL port
  envContent = envContent.replace(
    /NEXTAUTH_URL=http:\/\/localhost:\d+/,
    'NEXTAUTH_URL=http://localhost:' + port
  );

  // Remove any existing PORT= line, then add ours
  envContent = envContent.replace(/^PORT=.*\n?/m, '');
  envContent = envContent.trimEnd() + '\nPORT=' + port + '\n';

  writeFileSync(resolve(projectRoot, '.env.local'), envContent);

  console.log('Generated .env.local: port=' + port + ', database=' + dbName);
  return { port, dbName };
}

/**
 * Clone the main database to the worktree database using mongodump/mongorestore.
 */
function cloneDatabase(mainWorktreePath, dbName) {
  const hasMongodump = spawnSync('which', ['mongodump'], { encoding: 'utf8' }).status === 0;
  const hasMongorestore = spawnSync('which', ['mongorestore'], { encoding: 'utf8' }).status === 0;

  if (!hasMongodump || !hasMongorestore) {
    console.warn('Warning: mongodump/mongorestore not found. Skipping database clone.');
    console.warn('Install mongodb-database-tools to enable automatic database cloning.');
    return;
  }

  const mainEnvPath = resolve(mainWorktreePath, '.env.local');
  const mainEnv = readFileSync(mainEnvPath, 'utf8');
  const mainDbMatch = mainEnv.match(/MONGODB_URI=mongodb:\/\/localhost:27017\/([^\s]+)/);
  const mainDbName = mainDbMatch ? mainDbMatch[1] : 'weekly-eats-dev';

  console.log("Cloning database '" + mainDbName + "' -> '" + dbName + "'...");

  const tmpDir = execSync('mktemp -d', { encoding: 'utf8' }).trim();

  try {
    const dumpResult = spawnSync('mongodump', ['--db', mainDbName, '--out', tmpDir, '--quiet'], {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    if (dumpResult.status !== 0) {
      console.warn('Warning: mongodump failed (is MongoDB running?). Database will be empty.');
      return;
    }

    const restoreResult = spawnSync('mongorestore', ['--db', dbName, tmpDir + '/' + mainDbName, '--quiet', '--drop'], {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    if (restoreResult.status !== 0) {
      console.warn('Warning: mongorestore failed. Database may be empty.');
    } else {
      console.log('Database cloned successfully.');
    }
  } finally {
    try {
      execSync('rm -rf ' + JSON.stringify(tmpDir));
    } catch { /* ignore cleanup errors */ }
  }
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
// Main
// ---------------------------------------------------------------------------

const context = detectWorktreeContext();

if (!context.isWorktree) {
  runSetupDb();
} else {
  console.log("Worktree detected: branch '" + context.branchName + "'");
  const { dbName } = generateEnvLocal(context.mainWorktreePath, context.branchName);
  cloneDatabase(context.mainWorktreePath, dbName);
  runSetupDb();
  console.log('Worktree setup complete.');
}
