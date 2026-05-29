#!/usr/bin/env -S npx tsx
// test/manual/cli.ts
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';
import { validateBranch, validateSlot } from './validate-args.js';
import { loadManifest, manifestPath } from './manifest-io.js';
import { Engine } from './engine.js';
import { acquireLock, releaseLock, forceUnlock, readLock } from './lock.js';
import type { CliResult, Block, StatusAllResult } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename));

export interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean | undefined>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = [...argv];
  const command = args[0] && !args[0].startsWith('--') ? args.shift()! : 'help';
  const positional: string[] = [];
  const flags: Record<string, string | boolean | undefined> = {};
  while (args.length > 0) {
    const a = args.shift()!;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[0];
      if (next != null && !next.startsWith('--')) {
        flags[key] = next;
        args.shift();
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { command, positional, flags };
}

export interface Target {
  kind: 'manifest' | 'branch';
  name: string;
  slot: string;
}

export function resolveTarget(
  parsed: { flags: Record<string, unknown>; positional: string[] },
  getCurrentBranch: () => string,
  manifestExists: (name: string) => boolean = () => false
): Target {
  const slotFlag = parsed.flags.slot as string | undefined;
  if (parsed.flags.manifest) {
    return {
      kind: 'manifest',
      name: String(parsed.flags.manifest),
      slot: slotFlag ?? 'default',
    };
  }
  if (parsed.flags.branch) {
    return {
      kind: 'branch',
      name: String(parsed.flags.branch),
      slot: slotFlag ?? parsed.positional[0] ?? 'default',
    };
  }
  if (parsed.positional.length > 0) {
    const first = parsed.positional[0];
    if (manifestExists(first)) {
      return { kind: 'manifest', name: first, slot: parsed.positional[1] ?? 'default' };
    }
    return { kind: 'branch', name: first, slot: parsed.positional[1] ?? 'default' };
  }
  return { kind: 'branch', name: getCurrentBranch(), slot: 'default' };
}

const DB_ALLOWLIST = /^weekly-eats(-[a-z0-9-]+)?$/;

export function resolveDbSafety(uri: string, flags: Record<string, unknown>): { dbName: string } {
  const u = new URL(uri.replace(/^mongodb\+srv/, 'https').replace(/^mongodb/, 'http'));
  const host = u.hostname;
  const dbName = u.pathname.replace(/^\//, '') || 'weekly-eats';
  if (host !== 'localhost' && host !== '127.0.0.1' && !flags['allow-remote']) {
    throw new Error(`db safety: host "${host}" is not localhost; refusing without --allow-remote`);
  }
  if (!DB_ALLOWLIST.test(dbName)) {
    throw new Error(
      `db safety: DB name "${dbName}" not in allowlist (must match ^weekly-eats(-[a-z0-9-]+)?$)`
    );
  }
  if (dbName === 'weekly-eats' && !flags['allow-main-db']) {
    throw new Error(
      `db safety: refusing to operate on main DB "weekly-eats" without --allow-main-db`
    );
  }
  return { dbName };
}

function getCurrentGitBranch(): string {
  return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
}

/**
 * Build a branch-existence check for the orphan sweep. Injected into the engine
 * so engine.ts stays OS-free. With `--quiet`: exit 0 = exists, exit 1 = ref
 * absent (gone). Exit 128 (not a repo) or ENOENT (git missing) means the
 * environment is broken — THROW so the sweep aborts instead of nuking everything.
 *
 * Accepts an optional `_exec` override for testing (defaults to `execFileSync`).
 */
export function makeBranchExists(
  exec: typeof execFileSync = execFileSync
): (branch: string) => boolean {
  return (branch: string): boolean => {
    try {
      exec('git', ['rev-parse', '--verify', '--quiet', branch], { stdio: 'pipe' });
      return true;
    } catch (e: unknown) {
      const err = e as { status?: number; code?: string };
      if (err.status === 1) return false; // ref absent
      throw new Error(
        `branchExists: git rev-parse failed for "${branch}" (status=${err.status}, code=${err.code}) — aborting orphan sweep`
      );
    }
  };
}

function readMongoUri(): string {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  // Read from .env.local — same pattern as the old seed scripts
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) {
    throw new Error('MONGODB_URI not set and no .env.local found');
  }
  const content = readFileSync(envPath, 'utf8');
  const match = content.match(/^MONGODB_URI=(.+)$/m);
  if (!match) throw new Error('MONGODB_URI not found in .env.local');
  return match[1].trim();
}

async function loadBlocks(): Promise<Map<string, Block>> {
  const { registry } = await import('./scenarios/registry.js');
  return registry;
}

function printUsage(): void {
  process.stderr.write(`Usage: tsx test/manual/cli.ts <command> [args] [flags]

Commands:
  apply [target] [slot]         Apply manifest (idempotent)
  clean [target] [slot]         Remove tagged docs for this manifest
  clean --all --yes             Remove every _seedManifestId doc
  status [target] [slot]        Report what's seeded
  unlock [target] [slot]        Force-release a stale lock
  list                          List all manifests on disk
  gen-catalog [--check]         Regenerate CATALOG.md
  help [command]                Print this help

Flags:
  --manifest <name>             Load manifests/<name>.json directly
  --branch <name>               Override git branch detection
  --slot <name>                 Set slot (positional [slot] is shorthand)
  --json                        Machine-readable output
  --dry-run                     Validate without DB writes
  --verbose                     Log every DB write
  --yes                         Confirm destructive ops (required for clean --all)
  --force <id>                  Force a scenario to re-apply
  --force-unlock                Bypass lock check
  --allow-main-db               Operate on main DB (DANGEROUS)
  --allow-remote                Allow non-localhost (DANGEROUS)
  --help                        Show this help
`);
}

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.command === 'help' || parsed.flags.help) {
    printUsage();
    return 0;
  }

  // ─── Subcommands ────────────────────────────────────────────────────
  if (parsed.command === 'list') {
    const { readdirSync } = await import('node:fs');
    const dir = join(ROOT, 'manifests');
    if (!existsSync(dir)) return 0;
    for (const f of readdirSync(dir).sort()) if (f.endsWith('.json')) console.log(f);
    return 0;
  }

  if (parsed.command === 'gen-catalog') {
    const { generateCatalog, writeCatalog, readCatalog } = await import('./catalog-gen.js');
    const blocks = await loadBlocks();
    const generated = generateCatalog(blocks);
    const catalogPath = join(ROOT, 'scenarios', 'CATALOG.md');
    if (parsed.flags.check) {
      const current = await readCatalog(catalogPath);
      if (current !== generated) {
        process.stderr.write('CATALOG.md is stale. Run `npm run test:manual:gen-catalog`.\n');
        return 1;
      }
      return 0;
    }
    await writeCatalog(catalogPath, generated);
    return 0;
  }

  const uri = readMongoUri();
  resolveDbSafety(uri, parsed.flags);
  const client = await MongoClient.connect(uri);
  try {
    const db = client.db();

    // ── File-independent commands (no manifest file needed) ──
    if (parsed.command === 'status' && parsed.flags.all) {
      const blocks = await loadBlocks();
      const engine = new Engine(db, blocks);
      const result = await engine.statusAll();
      outputStatusAll(result, parsed);
      return 0;
    }

    if (parsed.command === 'unlock') {
      const target = resolveTarget(parsed, getCurrentGitBranch);
      if (target.kind !== 'branch') throw new Error('unlock requires a branch target');
      validateBranch(target.name);
      validateSlot(target.slot);
      const manifestId = `${target.name}::${target.slot}`;
      const removed = await forceUnlock(db, manifestId);
      if (removed) {
        process.stdout.write(
          `unlocked: ${manifestId}\n  was held by PID ${removed.pid} on host ${removed.hostname}\n  acquired at ${removed.acquiredAt.toISOString()}\n  invocation: ${removed.cliInvocation}\n`
        );
      } else {
        process.stdout.write(`no lock found for ${manifestId}\n`);
      }
      return 0;
    }

    // apply/clean/status: need a manifest
    const target = resolveTarget(parsed, getCurrentGitBranch, (name) =>
      existsSync(join(ROOT, 'manifests', `${name}.json`))
    );
    // Validate user-supplied branch/slot (defense in depth — they flow into file paths)
    if (target.kind === 'branch') {
      validateBranch(target.name);
      validateSlot(target.slot);
    }
    // For 'manifest' kind: name is a bare manifest filename, validated below by file-existence check
    const filePath =
      target.kind === 'manifest'
        ? join(
            ROOT,
            'manifests',
            target.slot === 'default' ? `${target.name}.json` : `${target.name}.${target.slot}.json`
          )
        : manifestPath(ROOT, target.name, target.slot);
    if (!existsSync(filePath)) {
      throw new Error(`manifest not found: ${filePath}`);
    }
    const manifest = await loadManifest(filePath);
    const manifestId = `${manifest.branch}::${manifest.slot}`;
    const blocks = await loadBlocks();
    const engine = new Engine(db, blocks);

    if (parsed.flags['dry-run']) {
      const r = await engine.status(manifest);
      output(r, parsed);
      return 0;
    }

    if (parsed.command === 'apply') {
      if (!parsed.flags['force-unlock']) {
        const existing = await readLock(db, manifestId);
        if (existing) {
          throw new Error(`lock: ${manifestId} is held by PID ${existing.pid}`);
        }
      }
      const lock = await acquireLock(db, manifestId, `apply ${manifest.branch}`);
      const releasedAt = { value: null as Date | null };
      try {
        const force = parsed.flags.force ? [String(parsed.flags.force)] : [];
        const result = await engine.apply(manifest, { force });
        releasedAt.value = new Date();
        result.lock = {
          acquiredAt: lock.acquiredAt.toISOString(),
          releasedAt: releasedAt.value.toISOString(),
        };
        output(result, parsed);
        return result.exitCode;
      } finally {
        await releaseLock(db, manifestId);
      }
    }

    if (parsed.command === 'clean') {
      if (parsed.flags.all) {
        if (!parsed.flags.yes) {
          throw new Error('clean --all requires --yes (destructive)');
        }
        // ─── Clean across all manifests ────────────────────────────
        const { KNOWN_COLLECTIONS } = await import('./types.js');
        let totalDeleted = 0;
        for (const col of KNOWN_COLLECTIONS) {
          const r = await db.collection(col).deleteMany({ _seedManifestId: { $exists: true } });
          totalDeleted += r.deletedCount ?? 0;
        }
        await db.collection('manualTestState').deleteMany({});
        process.stdout.write(`cleaned ${totalDeleted} docs across all manifests\n`);
        return 0;
      }
      const result = await engine.clean(manifest);
      output(result, parsed);
      return result.exitCode;
    }

    if (parsed.command === 'status') {
      const result = await engine.status(manifest);
      output(result, parsed);
      return result.exitCode;
    }

    throw new Error(`unknown command: ${parsed.command}`);
  } finally {
    await client.close();
  }
}

function outputStatusAll(result: StatusAllResult, parsed: ParsedArgs): void {
  if (parsed.flags.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (result.manifests.length === 0) {
    process.stdout.write('status --all: no seeded data found\n');
    return;
  }
  for (const m of result.manifests) {
    const cols = Object.entries(m.collections)
      .map(([c, n]) => `${c}:${n}`)
      .join(', ');
    process.stdout.write(`${m.manifestId}${m.hasOrphans ? ' (orphans)' : ''}: ${cols}\n`);
  }
}

function output(result: CliResult, parsed: ParsedArgs): void {
  if (parsed.flags.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write(
      `${result.command} ${result.manifestId}: ${result.ok ? 'OK' : 'FAILED'} (exit ${result.exitCode})\n`
    );
    for (const s of result.scenarios) {
      process.stdout.write(
        `  ${s.id} (${s.block}): ${s.status}${s.summary ? ` — ${s.summary}` : ''}${s.error ? ` [${s.error}]` : ''}\n`
      );
    }
    for (const w of result.warnings) process.stdout.write(`  warning: ${w}\n`);
  }
}

// Run when invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      process.stderr.write(`manual-test error: ${(e as Error).message}\n`);
      process.exit(1);
    }
  );
}
