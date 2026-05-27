// test/manual/manifest-io.ts
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { z } from 'zod';
import {
  validateBranch,
  validateSlot,
  sanitizeBranchForFilename,
  unsanitizeBranchFromFilename,
} from './validate-args.js';
import type { Manifest } from './types.js';

const ScenarioSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9_-]+$/),
  block: z.string().min(1),
  config: z.unknown().optional(),
  dependsOn: z.array(z.string()).optional(),
});

const StepMappingSchema = z.object({
  step: z.string().min(1),
  scenarioIds: z.array(z.string()),
  notes: z.string().optional(),
});

const ManifestSchema = z.object({
  schemaVersion: z.literal(1),
  branch: z.string().min(1),
  slot: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  scenarios: z.array(ScenarioSchema),
  stepMappings: z.array(StepMappingSchema).optional(),
});

export function validateManifest(input: unknown): Manifest {
  const parsed = ManifestSchema.parse(input);
  validateBranch(parsed.branch);
  validateSlot(parsed.slot);

  const ids = new Set<string>();
  for (const s of parsed.scenarios) {
    if (ids.has(s.id)) {
      throw new Error(`manifest: duplicate scenario id: ${s.id}`);
    }
    ids.add(s.id);
  }

  for (const s of parsed.scenarios) {
    for (const dep of s.dependsOn ?? []) {
      if (!ids.has(dep)) {
        throw new Error(`manifest: scenario "${s.id}" has unknown dependency: ${dep}`);
      }
    }
  }

  return parsed as Manifest;
}

export function manifestPath(rootDir: string, branchOrName: string, slot: string): string {
  // If branchOrName is a bare manifest name (no slashes and no special chars) and matches
  // a checked-in manifest filename, use it as-is (no sanitization, no slot suffix).
  // This is decided by the CLI caller passing pre-resolved names; here we just compute paths.
  const sanitized = sanitizeBranchForFilename(branchOrName);
  const filename = slot === 'default' ? `${sanitized}.json` : `${sanitized}.${slot}.json`;
  return join(rootDir, 'manifests', filename);
}

export async function loadManifest(filePath: string): Promise<Manifest> {
  const raw = await readFile(filePath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`manifest: invalid JSON at ${filePath}: ${(e as Error).message}`);
  }
  const m = validateManifest(parsed);

  // Verify branch field matches filename
  const filename = basename(filePath, '.json');
  // strip optional `.<slot>` suffix to recover the sanitized branch
  const sanitizedFromFile = filename.includes('.')
    ? filename.split('.').slice(0, -1).join('.')
    : filename;
  // Special-case: bare manifest names (e.g. "demo") — the manifest may have any branch
  // value the author chose; only enforce when the filename uses a sanitized branch path.
  if (
    sanitizedFromFile.includes('%2F') ||
    sanitizedFromFile === sanitizeBranchForFilename(m.branch)
  ) {
    const reconstructed = unsanitizeBranchFromFilename(sanitizedFromFile);
    if (reconstructed !== m.branch && sanitizedFromFile !== m.branch) {
      throw new Error(
        `manifest: branch field "${m.branch}" filename mismatch: filename "${filename}" expected branch "${reconstructed}"`
      );
    }
  }

  return m;
}

export async function saveManifest(rootDir: string, manifest: Manifest): Promise<string> {
  const path = manifestPath(rootDir, manifest.branch, manifest.slot);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return path;
}
