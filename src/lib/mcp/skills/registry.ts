import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface SkillMeta {
  /** Canonical id the agent passes to skills_get — the skill's directory name. */
  name: string;
  description: string;
}

export interface Skill extends SkillMeta {
  /** Full SKILL.md body with the YAML frontmatter stripped. */
  content: string;
}

/**
 * Explicit allowlist of installed skills. Adding a skill = add its directory
 * name here. This is also the path-traversal guard: getSkill only serves a
 * name in this set, so a crafted `name` can never escape the skills root.
 */
export const SKILL_DIRECTORIES = ['recipe-import'] as const;

// Set form of the allowlist — cast-free O(1) membership (CLAUDE.md: avoid `as`).
// A readonly tuple of strings is assignable to Iterable<string>, so no cast.
const SKILL_SET: ReadonlySet<string> = new Set(SKILL_DIRECTORIES);

const SKILLS_ROOT = join(process.cwd(), 'skills');

/**
 * Parse the minimal SKILL.md frontmatter — a leading `---` block of simple
 * `key: value` lines — and return it plus the remaining body. No YAML
 * dependency; the format is intentionally simple. Tolerates LF and CRLF
 * (`\r?\n`) so a Windows-authored / git-autocrlf SKILL.md still parses.
 */
export function parseFrontmatter(md: string): { meta: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(md);
  if (!match) return { meta: {}, body: md };
  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) meta[key] = value;
  }
  return { meta, body: match[2] };
}

// Reads once per call (no caching) — one skill, trivial cost, no serverless
// stale-state surface (decision 2026-05-31). An allowlisted skill whose file is
// missing throws ENOENT here BY DESIGN: that is a deployment/bundling bug, not a
// normal "not found". The tool handlers (Task 4) catch it and return a clean
// isError result, mirroring runTool's error boundary.
function readSkillMarkdown(name: string): string {
  return readFileSync(join(SKILLS_ROOT, name, 'SKILL.md'), 'utf8');
}

export function listSkills(): SkillMeta[] {
  return SKILL_DIRECTORIES.map((name) => {
    const { meta } = parseFrontmatter(readSkillMarkdown(name));
    return { name, description: meta.description ?? '' };
  });
}

export function getSkill(name: string): Skill | null {
  if (!SKILL_SET.has(name)) return null;
  const { meta, body } = parseFrontmatter(readSkillMarkdown(name));
  return { name, description: meta.description ?? '', content: body.trim() };
}
