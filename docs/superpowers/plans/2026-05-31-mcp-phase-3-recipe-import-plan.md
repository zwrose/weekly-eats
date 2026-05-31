# MCP Phase 3 — `recipe-import` Skill (Skills-over-MCP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the motivating `recipe-import` skill and deliver it _through the connector itself_ — the MCP server serves skills via two new tools, so every connecting agent auto-discovers them with no separate install.

**Architecture:** A versioned `skills/recipe-import/SKILL.md` source tree is the single source of truth. A small, dependency-free registry/loader (`src/lib/mcp/skills/registry.ts`) reads it from disk, guarded by an explicit `SKILL_DIRECTORIES` allowlist (which doubles as the path-traversal guard). Two new MCP tools — `skills_list` (metadata only) and `skills_get` (full `SKILL.md` body) — implement progressive disclosure and ride behind the existing `withMcpAuth` gate on `/api/mcp`. Server `instructions` advertise the skills so agents know to call `skills_list`. On Vercel, `outputFileTracingIncludes` bundles `skills/**` into the function so `fs` reads work in serverless.

**Tech Stack:** Next.js 16 (App Router), `mcp-handler` + `@modelcontextprotocol/sdk`, zod, Vitest. No new dependencies.

**Supersedes spec §6.6's out-of-band-install assumption** (decision recorded 2026-05-31; see Task 6). The skill is still a real, distributable `SKILL.md` — it is simply _also_ served over MCP rather than requiring a manual upload/clone.

---

## Background the engineer needs

**The connector already exists (Phases 1–2).** `/api/mcp` is a stateless Streamable HTTP MCP server built with `mcp-handler`, wrapped in `withMcpAuth` (OAuth-minted bearer tokens, `required: true`). Existing tools, already registered and tested:

| Tool                | Input (zod raw shape)                                                             | Returns (JSON text)                       |
| ------------------- | --------------------------------------------------------------------------------- | ----------------------------------------- |
| `food_items_search` | `{ query?, accessLevel?, page?, limit? }`                                         | paginated `{ data, total, page, … }`      |
| `food_items_get`    | `{ id }`                                                                          | one food item                             |
| `food_items_create` | `{ name, singularName, pluralName, unit }` (always personal, never global)        | created food item (has `_id`)             |
| `recipes_search`    | `{ query?, accessLevel?, tags?, ratings?, page?, limit? }`                        | paginated recipes                         |
| `recipes_get`       | `{ id }`                                                                          | one recipe with resolved ingredient names |
| `recipes_create`    | `{ title, emoji?, instructions, isGlobal?, ingredients: RecipeIngredientList[] }` | created recipe (has `_id`)                |

**Strict recipe structure** (`src/types/recipe.ts`) — the skill must satisfy this; `recipes_create` re-validates it:

```ts
interface RecipeIngredient {
  type: 'foodItem' | 'recipe';
  id: string; // a real foodItem _id or recipe _id — NEVER free text
  quantity: number;
  unit?: string; // only for foodItem ingredients
  prepInstructions?: string; // e.g. "chopped", "peeled and diced"
}
interface RecipeIngredientList {
  title?: string; // for sub-lists ("For the sauce")
  ingredients: RecipeIngredient[];
  isStandalone?: boolean;
}
// recipes_create takes ingredients: RecipeIngredientList[] and instructions: string
```

There is **no free-text ingredient** — every ingredient references a real `foodItem` id (with a unit) or another recipe id. The whole in-chat review (§7) exists to satisfy this invariant: parse → match each line to a catalog food item → create the ones that don't exist → assemble the lists with resolved ids+units.

**MCP tool handler conventions** (`src/lib/mcp/tool-helpers.ts`):

- A handler has signature `(args, extra: ToolExtra) => Promise<ToolResult>`.
- `ToolResult` is `{ isError?: true; content: Array<{ type: 'text'; text: string }> }`.
- `getAuthContext(extra)` pulls `{ userId, isAdmin }` off `extra.authInfo.extra`. **The skills tools do NOT need it** — skill content is static and not user-scoped; the `withMcpAuth` gate already ensures only an authenticated agent reaches the handler.
- `ToolServer.registerTool(name, { title, description, inputSchema }, handler)` registers a tool; `inputSchema` is a zod **raw shape** (plain object of zod validators), not a `z.object(...)`.

**Test conventions** (see `src/lib/mcp/tools/__tests__/food-items.test.ts`): mock the layer below with `vi.mock`, then `await import(...)` the module under test. Handlers are tested directly with a fake `extra = { authInfo: { extra: { userId: 'u1', isAdmin: false } } }`.

**Vercel/serverless caveat:** Next.js only bundles files it traces. Reading `skills/**` at runtime requires `outputFileTracingIncludes` (Task 3) or the files won't exist in the deployed function. Locally (dev + vitest) `process.cwd()` is the repo root, so `fs` reads work without it — which is why the loader tests pass before the bundling config lands.

---

## File Structure

| File                                                                   | Responsibility                                                                                                                      | Task |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `skills/recipe-import/SKILL.md` (Create)                               | The recipe-import skill: prose + the §7 orchestration. Source of truth.                                                             | 1    |
| `src/lib/mcp/skills/registry.ts` (Create)                              | Frontmatter parser + `listSkills()` / `getSkill()`; `SKILL_DIRECTORIES` allowlist.                                                  | 2    |
| `src/lib/mcp/skills/__tests__/registry.test.ts` (Create)               | Loader unit tests (parse, list, get, traversal guard).                                                                              | 2    |
| `next.config.ts` (Modify)                                              | `outputFileTracingIncludes` so `skills/**` is bundled into the MCP function.                                                        | 3    |
| `src/lib/mcp/tool-helpers.ts` (Modify)                                 | Export `toolText` so the skills tools reuse it (currently private).                                                                 | 4    |
| `src/lib/mcp/tools/skills.ts` (Create)                                 | `skills_list` + `skills_get` handlers + `registerSkillTools`.                                                                       | 4    |
| `src/lib/mcp/tools/__tests__/skills.test.ts` (Create)                  | Skills tool handler + registration + input-schema + error-path tests.                                                               | 4    |
| `src/lib/mcp/__tests__/register.test.ts` (Modify)                      | Extend the registration smoke test to also register the skills tools.                                                               | 4    |
| `src/app/api/[transport]/route.ts` (Modify)                            | Register skills tools; set server `instructions`.                                                                                   | 5    |
| `src/app/api/[transport]/__tests__/route-config.test.ts` (Create)      | NEW file — the existing `route.test.ts` (R4 401 test) is preserved. Asserts skills registered + `instructions` (mocks mcp-handler). | 5    |
| `docs/superpowers/specs/2026-05-29-agent-connector-design.md` (Modify) | Record skills-over-MCP decision in §6.6.                                                                                            | 6    |
| `docs/superpowers/plans/mcp-connector-progress.md` (Modify)            | Ledger: Phase 3 → in-progress/done + dated carryover.                                                                               | 6    |

---

### Task 1: Author the `recipe-import` SKILL.md

**Files:**

- Create: `skills/recipe-import/SKILL.md`

This is prose (no failing test — the loader tests in Task 2 will read it). It is **validated manually** (spec §8a: "Skill (Phase 3) — validated manually") by running a real import through the live connector. Write the file exactly as below.

- [ ] **Step 1: Create the skill directory and file**

Create `skills/recipe-import/SKILL.md` with this exact content:

```markdown
---
name: recipe-import
description: Import a recipe from a URL or PDF into Weekly Eats. Parse the source, match each ingredient to the user's food-item catalog (creating new items as needed), confirm the mapping in chat, then save a properly structured recipe via the Weekly Eats connector.
---

# Recipe Import

Turn a recipe the user gives you (a URL, a PDF, or pasted text) into a saved Weekly
Eats recipe. Weekly Eats recipes are **strictly structured**: every ingredient must
reference a real food item from the user's catalog (with a unit) — there is no
free-text ingredient. Your job is to bridge messy real-world recipe text to that
structure, confirming with the user before saving.

## When to use

Use this skill when the user asks to import, save, or add a recipe from a source —
e.g. "import this recipe: <url>", "save this recipe PDF to Weekly Eats", or pastes
recipe text and asks to add it.

## Tools you will use

All are provided by the connected Weekly Eats MCP server:

- `food_items_search` — find existing food items by name (the user's catalog plus
  shared/global items). Use this to match ingredient lines.
- `food_items_create` — create a new **personal** food item: `{ name, singularName,
pluralName, unit }`. Use only for ingredients with no good catalog match.
- `recipes_create` — save the recipe once everything is resolved.
- `recipes_search` / `recipes_get` — optional, to check whether a similar recipe
  already exists before creating a duplicate.

## The flow

### 1. Read the source

Read the URL or PDF the user provided using your own native file/URL reading — this
skill does **not** fetch or parse files for you. Extract:

- **title** (required) and an optional single **emoji** that fits the dish
- the list of **ingredient lines** (raw text, e.g. "2 cups all-purpose flour, sifted")
- the **instructions** as prose

If the user pasted text directly, work from that.

### 2. Parse each ingredient line

For each line, separate it into **quantity**, **unit**, **ingredient name**, and
optional **prep note**. Examples:

- "2 cups all-purpose flour, sifted" → quantity `2`, unit `cup`, name `all-purpose
flour`, prep `sifted`
- "3 large eggs" → quantity `3`, unit `each` (count-based), name `egg`
- "1/2 tsp kosher salt" → quantity `0.5`, unit `teaspoon`, name `kosher salt`

Normalize units to a singular, common form (cup, tablespoon, teaspoon, gram, ounce,
pound, milliliter, each, …). Convert fractions to decimals for `quantity`.

### 3. Match each ingredient to the catalog

For each parsed ingredient, call `food_items_search` with the core ingredient name
(drop adjectives like "large", "fresh", "organic" for the search; keep them as a prep
note or in the name only if they matter). Pick the best match from the results.

Track three buckets:

- **Matched** — a confident catalog hit. Record its `_id` and the unit you'll use.
- **Ambiguous** — multiple plausible hits, or a weak match. Needs the user to pick.
- **New** — no reasonable match. Will need `food_items_create`.

### 4. Confirm in chat (REQUIRED — do not skip)

Before creating anything, present the full mapping to the user in a compact table:
each ingredient line → the matched (or proposed-new) food item, the quantity, and the
unit. Clearly mark which items you would **create new**. Ask them to confirm or
correct. Wait for their response.

This is the human-in-the-loop step. Never save a recipe without it.

### 5. Create the confirmed-new food items

For each item the user confirmed as new, call `food_items_create` with `{ name,
singularName, pluralName, unit }`. Use a sensible singular/plural (e.g. name
"tomato", singular "tomato", plural "tomatoes"). Capture the returned `_id`.

Items created via the connector are always personal to the user (never global) — that
is enforced server-side; you don't set it.

### 6. Assemble the recipe structure

Build `ingredients` as an array of ingredient lists. Use a single list for a simple
recipe; use multiple lists with `title`s when the source groups ingredients (e.g.
"For the sauce", "For the topping"). Each ingredient is:

    { "type": "foodItem", "id": "<foodItem _id>", "quantity": <number>, "unit": "<unit>", "prepInstructions": "<optional>" }

Every `id` must be a real food item `_id` (matched or newly created). Never invent an
id and never emit a free-text ingredient.

Keep the source's instructions as the `instructions` string (lightly cleaned —
numbered steps or paragraphs are fine).

### 7. Save and link

Call `recipes_create` with `{ title, emoji?, instructions, ingredients }`. On success
it returns the created recipe (with its `_id`). Give the user a link to the recipe in
the app: `/recipes/<_id>`.

If `recipes_create` returns an error (it re-validates the structure), read the message,
fix the offending ingredient (usually a bad id or a missing unit), and retry — do not
silently drop ingredients.

## Guardrails

- **Confirm before writing.** Steps 4 is mandatory. No surprise saves.
- **No free-text ingredients.** If you can't match or create a food item for a line,
  raise it with the user rather than dropping or faking it.
- **One emoji max**, and only if it genuinely fits; omit otherwise.
- **Don't create duplicate food items.** Prefer a catalog match; only create when
  there's truly no good fit.
```

- [ ] **Step 2: Commit**

```bash
git add skills/recipe-import/SKILL.md
git commit -m "feat(mcp): add recipe-import skill content (Phase 3)"
```

---

### Task 2: Skill registry / loader

**Files:**

- Create: `src/lib/mcp/skills/registry.ts`
- Test: `src/lib/mcp/skills/__tests__/registry.test.ts`

A dependency-free loader. `SKILL_DIRECTORIES` is the explicit allowlist of installed skills — adding a skill means adding its directory name here, and it doubles as the path-traversal guard (`getSkill` only serves a name in the set). Frontmatter is parsed with a tiny regex (the SKILL.md format frontmatter is simple `key: value` lines), so no YAML dependency.

- [ ] **Step 1: Write the failing test**

Create `src/lib/mcp/skills/__tests__/registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  parseFrontmatter,
  listSkills,
  getSkill,
  SKILL_DIRECTORIES,
} from '@/lib/mcp/skills/registry';

describe('parseFrontmatter', () => {
  it('extracts key/value frontmatter and returns the body without it', () => {
    const md = '---\nname: foo\ndescription: A test skill\n---\n# Body\ntext';
    const { meta, body } = parseFrontmatter(md);
    expect(meta.name).toBe('foo');
    expect(meta.description).toBe('A test skill');
    expect(body.trim()).toBe('# Body\ntext');
  });

  it('returns empty meta and the original content when there is no frontmatter', () => {
    const { meta, body } = parseFrontmatter('# No frontmatter');
    expect(meta).toEqual({});
    expect(body).toBe('# No frontmatter');
  });

  it('keeps colons in the value (e.g. URLs)', () => {
    const { meta } = parseFrontmatter('---\nurl: https://example.com/x\n---\nbody');
    expect(meta.url).toBe('https://example.com/x');
  });

  it('parses CRLF-terminated frontmatter (Windows / git autocrlf)', () => {
    const md = '---\r\nname: foo\r\ndescription: A test skill\r\n---\r\n# Body';
    const { meta, body } = parseFrontmatter(md);
    expect(meta.name).toBe('foo');
    expect(meta.description).toBe('A test skill');
    expect(body.trim()).toBe('# Body');
  });
});

describe('listSkills', () => {
  it('lists every installed skill with its directory name and description', () => {
    const skills = listSkills();
    expect(skills.map((s) => s.name)).toEqual([...SKILL_DIRECTORIES]);
    const recipeImport = skills.find((s) => s.name === 'recipe-import');
    expect(recipeImport).toBeDefined();
    expect(recipeImport!.description.toLowerCase()).toContain('recipe');
  });
});

describe('getSkill', () => {
  it('returns the full SKILL.md body for an installed skill', () => {
    const skill = getSkill('recipe-import');
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe('recipe-import');
    // The body references the tools the skill orchestrates.
    expect(skill!.content).toContain('recipes_create');
    expect(skill!.content).toContain('food_items_search');
    // Frontmatter is stripped from the served content.
    expect(skill!.content.startsWith('---')).toBe(false);
  });

  it('returns null for an unknown skill', () => {
    expect(getSkill('does-not-exist')).toBeNull();
  });

  it('returns null for a path-traversal attempt (allowlist guard)', () => {
    expect(getSkill('../../etc/passwd')).toBeNull();
    expect(getSkill('recipe-import/../recipe-import')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/lib/mcp/skills/__tests__/registry.test.ts`
Expected: FAIL — cannot resolve `@/lib/mcp/skills/registry` (module does not exist).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/mcp/skills/registry.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/lib/mcp/skills/__tests__/registry.test.ts`
Expected: PASS (all 8 cases). The `listSkills`/`getSkill` cases read the real `skills/recipe-import/SKILL.md` created in Task 1.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mcp/skills/registry.ts src/lib/mcp/skills/__tests__/registry.test.ts
git commit -m "feat(mcp): add skill registry/loader with allowlist guard (Phase 3)"
```

---

### Task 3: Bundle `skills/**` into the Vercel function

**Files:**

- Modify: `next.config.ts`

`outputFileTracingIncludes` (stable top-level config in Next 16) tells the build to trace `skills/**` into the serverless function for the MCP route, so the loader's `fs` reads resolve in production. Without this the tools 500 in deployment (but pass locally, since dev/vitest run from the repo root).

- [ ] **Step 1: Add the tracing include**

Edit `next.config.ts`. Add the `outputFileTracingIncludes` key to the `nextConfig` object (top level, sibling of `images` and `rewrites`):

```ts
const nextConfig: NextConfig = {
  images: {
    // …unchanged…
  },
  // Bundle the skills source tree into the MCP function so the skill
  // registry's fs reads resolve in Vercel serverless (Phase 3).
  outputFileTracingIncludes: {
    '/api/[transport]': ['./skills/**/*'],
  },
  async rewrites() {
    // …unchanged…
  },
};
```

- [ ] **Step 2: Verify the build still succeeds and the key is well-formed**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS (no type error on the config — `outputFileTracingIncludes` is a valid `NextConfig` key).

Note: full bundling correctness is only observable on a real Vercel deploy (the loader resolves files locally regardless). The manual-verification step at the end of the phase covers the live `skills_get` call.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "build(mcp): trace skills/ into the MCP function for Vercel (Phase 3)"
```

---

### Task 4: `skills_list` + `skills_get` MCP tools

**Files:**

- Modify: `src/lib/mcp/tool-helpers.ts` (export `toolText`)
- Create: `src/lib/mcp/tools/skills.ts`
- Test: `src/lib/mcp/tools/__tests__/skills.test.ts`
- Modify: `src/lib/mcp/__tests__/register.test.ts` (extend the smoke test)

Two tools implementing progressive disclosure. `skills_list` returns metadata JSON (so the agent doesn't pull full skill bodies into context until needed). `skills_get` returns the raw `SKILL.md` markdown as text (NOT JSON-wrapped — the agent consumes it as instructions). An unknown name returns an `isError` result pointing the agent back at `skills_list`. These tools take no `userId` — content is static.

**Error boundary (review arch-001/test-002):** the other tools funnel through `runTool`, which JSON-stringifies success — wrong for `skills_get`, which must return raw markdown. So instead of `runTool`, each handler has its own try/catch that returns a clean `isError` result and logs via `logError`. This way a missing/unreadable `SKILL.md` (the exact failure Task 3 warns about) degrades gracefully instead of throwing an unhandled rejection into `mcp-handler`. The success path stays raw text.

**`toolText` (review arch-002/code-003):** rather than copy the private `toolText` from `tool-helpers.ts`, export it there and reuse it — one shared helper, no drift.

- [ ] **Step 1: Export `toolText` from `tool-helpers.ts`**

Edit `src/lib/mcp/tool-helpers.ts`. Change the `toolText` declaration from private to exported (the only change — `runTool` already calls it):

```ts
// before:  function toolText(text: string, isError?: true): ToolResult {
// after:
export function toolText(text: string, isError?: true): ToolResult {
  return isError
    ? { isError, content: [{ type: 'text', text }] }
    : { content: [{ type: 'text', text }] };
}
```

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/lib/mcp/__tests__/tool-helpers.test.ts`
Expected: PASS — exporting a previously-private function changes no behavior; the existing tool-helpers tests stay green.

- [ ] **Step 2: Write the failing test**

Create `src/lib/mcp/tools/__tests__/skills.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

const listSkillsMock = vi.fn();
const getSkillMock = vi.fn();

vi.mock('@/lib/mcp/skills/registry', () => ({
  listSkills: (...a: unknown[]) => listSkillsMock(...a),
  getSkill: (...a: unknown[]) => getSkillMock(...a),
}));

const { skillsListInput, skillsGetInput, skillsListHandler, skillsGetHandler, registerSkillTools } =
  await import('@/lib/mcp/tools/skills');

const extra = { authInfo: { extra: { userId: 'u1', isAdmin: false } } };

beforeEach(() => {
  listSkillsMock.mockReset();
  getSkillMock.mockReset();
});

describe('skills_list tool', () => {
  it('returns the skill metadata as JSON text', async () => {
    listSkillsMock.mockReturnValueOnce([
      { name: 'recipe-import', description: 'Import a recipe.' },
    ]);
    const res = await skillsListHandler({}, extra);
    expect(res.isError).toBeUndefined();
    expect(JSON.parse(res.content[0].text)).toEqual([
      { name: 'recipe-import', description: 'Import a recipe.' },
    ]);
  });

  it('returns an isError result if listSkills throws (e.g. missing bundled file)', async () => {
    listSkillsMock.mockImplementationOnce(() => {
      throw new Error('ENOENT');
    });
    const res = await skillsListHandler({}, extra);
    expect(res.isError).toBe(true);
  });
});

describe('skills_get tool', () => {
  it('returns the raw SKILL.md body as text (not JSON-wrapped)', async () => {
    getSkillMock.mockReturnValueOnce({
      name: 'recipe-import',
      description: 'Import a recipe.',
      content: '# Recipe Import\nsteps...',
    });
    const res = await skillsGetHandler({ name: 'recipe-import' }, extra);
    expect(res.isError).toBeUndefined();
    expect(res.content[0].text).toBe('# Recipe Import\nsteps...');
    expect(getSkillMock).toHaveBeenCalledWith('recipe-import');
  });

  it('returns an isError result pointing at skills_list for an unknown skill', async () => {
    getSkillMock.mockReturnValueOnce(null);
    const res = await skillsGetHandler({ name: 'nope' }, extra);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('skills_list');
  });

  it('truncates an over-long name in the unknown-skill message (does not echo unbounded input)', async () => {
    getSkillMock.mockReturnValueOnce(null);
    const res = await skillsGetHandler({ name: 'x'.repeat(500) }, extra);
    expect(res.isError).toBe(true);
    // The echoed segment is capped; the whole message stays short.
    expect(res.content[0].text.length).toBeLessThan(160);
  });

  it('returns an isError result if getSkill throws (e.g. missing bundled file)', async () => {
    getSkillMock.mockImplementationOnce(() => {
      throw new Error('ENOENT');
    });
    const res = await skillsGetHandler({ name: 'recipe-import' }, extra);
    expect(res.isError).toBe(true);
  });
});

describe('skills tool input schemas', () => {
  it('skills_get requires a name string', () => {
    expect(z.object(skillsGetInput).safeParse({}).success).toBe(false);
    expect(z.object(skillsGetInput).safeParse({ name: 'recipe-import' }).success).toBe(true);
  });

  it('skills_list accepts an empty object', () => {
    expect(z.object(skillsListInput).safeParse({}).success).toBe(true);
  });
});

describe('registerSkillTools', () => {
  it('registers skills_list and skills_get on the server', () => {
    const registerTool = vi.fn();
    registerSkillTools({ registerTool } as never);
    const names = registerTool.mock.calls.map((c) => c[0]);
    expect(names).toEqual(['skills_list', 'skills_get']);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/lib/mcp/tools/__tests__/skills.test.ts`
Expected: FAIL — cannot resolve `@/lib/mcp/tools/skills`.

- [ ] **Step 4: Write minimal implementation**

Create `src/lib/mcp/tools/skills.ts`:

```ts
import { z } from 'zod';
import { logError } from '@/lib/errors';
import { listSkills, getSkill } from '@/lib/mcp/skills/registry';
import { toolText, type ToolExtra, type ToolResult, type ToolServer } from '@/lib/mcp/tool-helpers';

// --- input shapes (zod raw shapes for registerTool inputSchema) ---

export const skillsListInput = {};

export const skillsGetInput = {
  name: z.string(),
};

// --- handlers ---
// No auth context needed: skill content is static, not user-scoped. The
// withMcpAuth gate already ensures only an authenticated agent reaches here.
// Each handler has its own try/catch (not runTool — skills_get must return raw
// markdown, not JSON) so a missing/unreadable SKILL.md degrades to a clean
// isError result instead of throwing into mcp-handler.

export async function skillsListHandler(_args: unknown, _extra: ToolExtra): Promise<ToolResult> {
  try {
    return toolText(JSON.stringify(listSkills()));
  } catch (error) {
    logError('McpSkillsList', error);
    return toolText('Could not load skills right now. Please try again.', true);
  }
}

export async function skillsGetHandler(
  args: { name: string },
  _extra: ToolExtra
): Promise<ToolResult> {
  try {
    const skill = getSkill(args.name);
    if (!skill) {
      // Bound the echoed name so we never reflect unbounded agent input.
      const shown = String(args.name).slice(0, 64);
      return toolText(`Unknown skill: "${shown}". Call skills_list to see available skills.`, true);
    }
    return toolText(skill.content);
  } catch (error) {
    logError('McpSkillsGet', error);
    return toolText('Could not load that skill right now. Please try again.', true);
  }
}

// --- registration ---

export function registerSkillTools(server: ToolServer): void {
  server.registerTool(
    'skills_list',
    {
      title: 'List available skills',
      description:
        "List the guided skills (multi-step workflows) this connector provides. Returns each skill's name and description. Call this first to discover skills, then skills_get to load one.",
      inputSchema: skillsListInput,
    },
    skillsListHandler as never
  );
  server.registerTool(
    'skills_get',
    {
      title: 'Get a skill',
      description:
        'Fetch the full step-by-step instructions for a skill by name (use a name from skills_list). Load and follow the returned instructions before starting that task.',
      inputSchema: skillsGetInput,
    },
    skillsGetHandler as never
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/lib/mcp/tools/__tests__/skills.test.ts`
Expected: PASS (9 cases).

- [ ] **Step 6: Extend the registration smoke test**

`src/lib/mcp/__tests__/register.test.ts` registers the Phase-1 tools on a real `McpServer` and asserts no throw. `registerSkillTools` is pure registration (it never reads the filesystem — only the handlers do), so it's safe to add here. Edit the file:

Add the import alongside the others:

```ts
const { registerSkillTools } = await import('@/lib/mcp/tools/skills');
```

Update the test to register skills too and rename it:

```ts
describe('tool registration', () => {
  it('registers all tools on a real McpServer without throwing', () => {
    const server = new McpServer({ name: 'weekly-eats-test', version: '0.0.0' });
    expect(() => {
      registerFoodItemTools(server as never);
      registerRecipeTools(server as never);
      registerSkillTools(server as never);
    }).not.toThrow();
  });
});
```

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/lib/mcp/__tests__/register.test.ts`
Expected: PASS — all three register functions run without throwing.

- [ ] **Step 7: Commit**

```bash
git add src/lib/mcp/tool-helpers.ts src/lib/mcp/tools/skills.ts src/lib/mcp/tools/__tests__/skills.test.ts src/lib/mcp/__tests__/register.test.ts
git commit -m "feat(mcp): add skills_list and skills_get tools (Phase 3)"
```

---

### Task 5: Register skills tools + advertise via server `instructions`

**Files:**

- Modify: `src/app/api/[transport]/route.ts`
- Test (Create): `src/app/api/[transport]/__tests__/route-config.test.ts`
- **Preserve unchanged:** `src/app/api/[transport]/__tests__/route.test.ts` (the existing Phase-2 R4 test: unauthenticated POST → 401 + `resource_metadata`).

Wire `registerSkillTools` into the handler and set `instructions` (the 2nd arg of `createMcpHandler`, currently `{}`) so the connector tells agents skills exist.

> **Why a NEW test file (review code-001/test-001):** `route.test.ts` already exists and tests the auth gate by importing the **real** `route` (real `createMcpHandler` + `withMcpAuth`) and asserting a 401. The config assertions below must **mock** `mcp-handler` to capture the `createMcpHandler` args — and that mock makes the real-handler 401 test impossible in the same module. The two are mutually exclusive per-file, so the new config test goes in its own file `route-config.test.ts`. **Do not overwrite or modify `route.test.ts`** — it must keep passing. The transport positive path still can't run under jsdom (documented in the ledger), which is why we assert configuration, not a live tool call.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/[transport]/__tests__/route-config.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

const createMcpHandlerMock = vi.fn(() => 'base-handler');
const withMcpAuthMock = vi.fn((h: unknown) => h);

vi.mock('mcp-handler', () => ({
  createMcpHandler: (...a: unknown[]) => createMcpHandlerMock(...a),
  withMcpAuth: (...a: unknown[]) => withMcpAuthMock(...a),
}));

const registerFoodItemToolsMock = vi.fn();
const registerRecipeToolsMock = vi.fn();
const registerSkillToolsMock = vi.fn();

vi.mock('@/lib/mcp/tools/food-items', () => ({
  registerFoodItemTools: (...a: unknown[]) => registerFoodItemToolsMock(...a),
}));
vi.mock('@/lib/mcp/tools/recipes', () => ({
  registerRecipeTools: (...a: unknown[]) => registerRecipeToolsMock(...a),
}));
vi.mock('@/lib/mcp/tools/skills', () => ({
  registerSkillTools: (...a: unknown[]) => registerSkillToolsMock(...a),
}));
vi.mock('@/lib/mcp/verify-token', () => ({ verifyToken: vi.fn() }));

await import('../route');

describe('MCP transport route configuration', () => {
  it('passes server instructions that mention skills_list', () => {
    const serverOptions = createMcpHandlerMock.mock.calls[0][1] as { instructions?: string };
    expect(serverOptions.instructions).toBeDefined();
    expect(serverOptions.instructions).toContain('skills_list');
  });

  it('registers food-item, recipe, and skill tools in the setup callback', () => {
    const setup = createMcpHandlerMock.mock.calls[0][0] as (s: unknown) => void;
    const fakeServer = { registerTool: vi.fn() };
    setup(fakeServer);
    expect(registerFoodItemToolsMock).toHaveBeenCalledWith(fakeServer);
    expect(registerRecipeToolsMock).toHaveBeenCalledWith(fakeServer);
    expect(registerSkillToolsMock).toHaveBeenCalledWith(fakeServer);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run 'src/app/api/[transport]/__tests__/route-config.test.ts'`
Expected: FAIL — `registerSkillToolsMock` not called (route doesn't register skills yet) and `instructions` is undefined.

- [ ] **Step 3: Modify the route**

Edit `src/app/api/[transport]/route.ts`. Add the import and update the `createMcpHandler` call:

```ts
import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { registerFoodItemTools } from '@/lib/mcp/tools/food-items';
import { registerRecipeTools } from '@/lib/mcp/tools/recipes';
import { registerSkillTools } from '@/lib/mcp/tools/skills';
import { verifyToken } from '@/lib/mcp/verify-token';

// Vercel function timeout (Fluid Compute). Raise if tool calls need longer.
export const maxDuration = 60;

const handler = createMcpHandler(
  (server) => {
    // The SDK's McpServer.registerTool is generic over the zod input shape, so
    // it isn't structurally identical to our minimal ToolServer interface
    // (Task 11, Step 9). McpServer provides registerTool, so the cast is sound.
    registerFoodItemTools(server as never);
    registerRecipeTools(server as never);
    registerSkillTools(server as never);
  },
  {
    // Surfaced to clients on initialize. Tells the agent that beyond the data
    // tools, this connector ships guided skills it should discover (Phase 3).
    instructions:
      'Weekly Eats connector. Beyond the data tools, this server provides guided skills — multi-step workflows for common tasks. Call skills_list to discover them (for example, importing a recipe from a URL or PDF), then call skills_get with the skill name to load its step-by-step instructions before starting that task.',
  },
  { basePath: '/api' }
);
```

(The `withMcpAuth` block and the `GET/POST/DELETE/OPTIONS` exports below are unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run 'src/app/api/[transport]/__tests__/route-config.test.ts'`
Expected: PASS (2 cases).

- [ ] **Step 5: Verify the preserved R4 test still passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run 'src/app/api/[transport]/__tests__/route.test.ts'`
Expected: PASS — the existing unauthenticated-POST → 401 + `resource_metadata` test is unaffected by adding a third register call + `instructions`.

- [ ] **Step 6: Commit**

```bash
git add 'src/app/api/[transport]/route.ts' 'src/app/api/[transport]/__tests__/route-config.test.ts'
git commit -m "feat(mcp): register skills tools and advertise via server instructions (Phase 3)"
```

---

### Task 6: Record the skills-over-MCP decision (spec + ledger)

**Files:**

- Modify: `docs/superpowers/specs/2026-05-29-agent-connector-design.md`
- Modify: `docs/superpowers/plans/mcp-connector-progress.md`

Docs only — no tests. Records the architectural decision that supersedes §6.6's out-of-band-install assumption, so the spec stays the source of truth.

- [ ] **Step 1: Annotate §6.6 in the spec**

In `docs/superpowers/specs/2026-05-29-agent-connector-design.md`, find the `### 6.6 \`recipe-import\` skill` section. Immediately after its first paragraph (the one ending "Installable and customizable in Claude."), insert this note:

```markdown
> **Delivery decision (2026-05-31, Phase 3): skills-over-MCP.** Rather than relying
> solely on out-of-band install (plugin/upload/clone), the connector itself serves its
> skills. `/api/mcp` exposes two tools — `skills_list` (metadata) and `skills_get`
> (full `SKILL.md` body) — using progressive disclosure, and advertises them via the
> MCP server `instructions`. Any agent that connects auto-discovers the skill with no
> separate install. The `SKILL.md` remains a real, versioned, distributable file under
> `skills/<name>/`; it is simply also reachable through the connector. There is no MCP
> protocol "skills capability" today (Skills and MCP are complementary standards), so
> this tools-based delivery is the de-facto pattern. Reference-file serving (a third
> tool) is deferred until a skill needs it (YAGNI).
```

- [ ] **Step 2: Update the ledger Phase status table**

In `docs/superpowers/plans/mcp-connector-progress.md`, change the Phase 3 row of the Phase status table from:

```markdown
| 3 | `recipe-import` skill | pending | — | — | — |
```

to:

```markdown
| 3 | `recipe-import` skill (skills-over-MCP delivery) | **in-progress** — plan written; skills_list/skills_get + SKILL.md | [`plan`](2026-05-31-mcp-phase-3-recipe-import-plan.md) | — | — |
```

- [ ] **Step 3: Add a dated carryover to the ledger**

In `docs/superpowers/plans/mcp-connector-progress.md`, under the "## Decisions & carryovers" section, add this entry at the top of the dated list:

```markdown
- **2026-05-31 — Phase 3 delivers the `recipe-import` skill via skills-over-MCP (supersedes spec §6.6 out-of-band install).** The connector serves its own skills: `/api/mcp` exposes `skills_list` (metadata) + `skills_get` (full `SKILL.md`) with progressive disclosure, advertised through the MCP server `instructions`. Source of truth is a versioned `skills/recipe-import/SKILL.md`; `outputFileTracingIncludes` (`next.config.ts`) bundles `skills/**` into the function so the loader's `fs` reads resolve on Vercel. Path-traversal-safe via an explicit `SKILL_DIRECTORIES` allowlist. Reference-file serving deferred (YAGNI). Researched 2026-05-31: no MCP protocol "skills capability" exists yet — Skills and MCP are complementary standards — so tools-based delivery (cf. `agentskills-mcp`) is the de-facto pattern. The `SKILL.md` prose is validated manually (§8a), not unit-tested; the loader + tools are unit-tested.
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-05-29-agent-connector-design.md docs/superpowers/plans/mcp-connector-progress.md
git commit -m "docs(mcp): record skills-over-MCP delivery decision (Phase 3)"
```

---

### Task 7: Final validation

**Files:** none (validation only)

- [ ] **Step 1: Run the full check once**

Run: `npm run check`
Expected: lint clean, all tests pass (existing 1606 + the new registry/skills/route tests), build succeeds. If the Turbopack/build cache complains with MODULE_NOT_FOUND, run `npm run clean` first and re-run.

- [ ] **Step 2: Confirm no regressions in the MCP suite specifically**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/lib/mcp src/app/api/[transport]`
Expected: PASS — food-items, recipes, skills, registry, verify-token, and route-config tests all green.

- [ ] **Step 3: Commit anything outstanding**

```bash
git status   # should be clean if all prior tasks committed
```

---

## Manual validation (post-merge-readiness, not a code task)

Per spec §8a, the skill prose is validated manually. After the phase lands and is deployed to a preview (the connector is already live there):

1. In Claude, confirm the Weekly Eats connector is connected. The connector's `instructions` should surface; `skills_list` should be callable and return `recipe-import`.
2. `skills_get` `recipe-import` → returns the full SKILL.md body.
3. Give Claude a real recipe URL and ask it to import it. Confirm the in-chat review step (the ingredient-mapping table) appears **before** any write, that new food items are created on confirmation, and that `recipes_create` saves a structured recipe with resolved ids. Verify the returned `/recipes/<id>` link opens the recipe in the app.
4. Spot-check an error path: a recipe with an ingredient that has no catalog match → the skill should ask, not drop/fake it.

Capture results on the draft PR (`/manual-testing` posts a checkbox plan if desired).

---

## Self-Review

**1. Spec coverage (§6.6, §7, §11 Phase 3):**

- §6.6 "distributable, installable Claude skill (SKILL.md + supporting files)" → Task 1 (`skills/recipe-import/SKILL.md`); supporting/reference files deferred (YAGNI, recorded in Task 6). Delivery changed to skills-over-MCP, recorded in Task 6.
- §6.6 "relies on Claude's native file/URL reading" → SKILL.md Step "Read the source" makes this explicit; no fetcher/parser built. ✓
- §7 data flow (parse → search → confirm → create new → assemble → create → link) → SKILL.md steps 1–7. ✓
- §7 "strict structure, re-validates at recipes.create" → SKILL.md step 6 + guardrails; error-retry in step 7. ✓
- §11 Phase 3 "build and package the skill on top of Phase 1–2 tools" → Tasks 1–5. "installable in Claude" → served by the connector (Tasks 4–5). ✓
- §8a "Skill (Phase 3) — validated manually" → Manual validation section; loader/tools are unit-tested. ✓

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N". Every code step shows full code. ✓

**3. Type consistency:** `SkillMeta { name, description }` / `Skill extends SkillMeta { content }` used consistently in registry + tools + tests. `listSkills(): SkillMeta[]`, `getSkill(name): Skill | null` match their call sites in `skills.ts` and both test files. `SKILL_DIRECTORIES` is `readonly` and membership is checked cast-free via `SKILL_SET` (`new Set(SKILL_DIRECTORIES)`). `toolText`/`ToolServer`/`ToolExtra`/`ToolResult` all imported from `tool-helpers` (`toolText` newly exported in Task 4 Step 1). Tool names `skills_list`/`skills_get` match between `skills.ts`, `skills.test.ts`, and `route-config.test.ts`. ✓

**Gap check:** Reference-file tool intentionally omitted (YAGNI, recorded). No schema/DB migration (skills are static files — no migration story needed; noted). No UI (no mobile/responsive concern). ✓

**4. Review-applied revisions (loop 1):** route test moved to a new `route-config.test.ts` so the Phase-2 R4 test (`route.test.ts`) is preserved (F1); skills handlers get their own try/catch error boundary so a missing `SKILL.md` returns `isError` not an unhandled throw, with ENOENT-path tests (F2); `as readonly string[]` replaced by a `Set` (F3); `parseFrontmatter` handles CRLF + a CRLF test (F4); input-schema tests added (F5); per-call fs reads kept (no cache) by decision (F6, skipped); `toolText` exported and reused (F7); `register.test.ts` extended to cover skills registration (F8); unknown-skill error message truncates the echoed name (F9). ✓
