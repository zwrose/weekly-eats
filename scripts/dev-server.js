#!/usr/bin/env node

/**
 * Dev server wrapper that reads PORT from .env.local and passes it
 * explicitly to `next dev --turbopack --port <N>`.
 *
 * This is more reliable than relying on Next.js to load PORT from .env.local,
 * which sometimes doesn't work correctly and causes worktrees to start on
 * the wrong port.
 *
 * Usage: node scripts/dev-server.js [--skip-setup]
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const skipSetup = process.argv.includes('--skip-setup');

// Run setup first (unless skipped)
if (!skipSetup) {
  try {
    execSync('node scripts/setup-worktree.js', { cwd: projectRoot, stdio: 'inherit' });
  } catch {
    // setup-worktree.js handles its own errors gracefully
  }
}

// Read PORT from .env.local
let port = 3000;
const envPath = resolve(projectRoot, '.env.local');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf8');
  const portMatch = envContent.match(/^PORT=(\d+)/m);
  if (portMatch) {
    port = parseInt(portMatch[1], 10);
  }
}

console.log('Starting dev server on port ' + port + '...');

const child = spawn('npx', ['next', 'dev', '--turbopack', '--port', String(port)], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: { ...process.env }
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    child.kill(signal);
  });
}
