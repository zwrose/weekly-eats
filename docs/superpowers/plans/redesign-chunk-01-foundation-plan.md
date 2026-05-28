# Chunk 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the dark-first token + theme + typography + icon foundation so every existing screen renders with the redesign's tokens/fonts (rough but functional), drop light mode (plumbing preserved), and complete the one-time redesign setup (draft PR, CI trigger, `review-code` base override, local dev DB, interim server-side approval gate).

**Architecture:** A new `src/lib/design-tokens.ts` holds the canonical dark token values from the design bundle. `src/lib/theme.ts` is rewritten to a single `darkTheme` that maps those tokens onto MUI's palette (+ custom palette keys `section`/`mealColor`/`accentUtility`) and typography (standard variants retuned + custom `display*`/`body*`/`label*` variants), declared via module augmentation in `src/types/mui.d.ts`. Fonts (Bricolage Grotesque, Outfit) and the Material Symbols icon webfont load through `next/font/google` in the root layout; a new `src/components/ui/Icon.tsx` renders ligature icons (decorative by default). Light-mode wiring (toggle UI, `themeChange` event, cookie-driven mode, dual themes) is removed while keeping the theme function shape and `User.theme` field intact. An interim server-side `token.isApproved` gate lands in `src/middleware.ts`.

**Tech Stack:** Next.js 15 (App Router), React 19, MUI v7, `@mui/material-nextjs` (emotion SSR), `next/font/google`, NextAuth (JWT), Vitest + React Testing Library.

**Scope boundary (do NOT build in this chunk):** `SectionThemeProvider`, the `getSectionForPath` helper / `useActiveSection` hook, any `nav/*` component, per-feature `layout.tsx` accent wiring, and **icon call-site migration** all belong to Chunk 2+ (nav) and Chunks 3–6 (surfaces). Chunk 1 only _creates_ the `Icon` component and _loads_ its webfont — it swaps zero call sites. `@mui/icons-material` stays installed (removed in Chunk 11). The theme's custom palette keys are _populated_ here so later chunks can consume them, but the per-section rebinding mechanism is not built yet (default `primary` = `section.plans`).

---

## Canonical token values (source of truth for Task 1)

From `docs/design/weekly-eats-redesign/project/design-system.md` (dark column) + spec §2. **Dark only** — the Light column is dropped.

| Group           | Keys (dark values)                                                                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `surface`       | base `#0f1115`, raised `#181b21`, elevated `#1e222a`, sunken `#141619`, sheet `#1a1e26`                                                                                 |
| `text`          | primary `#e7e9ee`, secondary `#9097a6`, muted `#5b6170`, past `#7b818f`                                                                                                 |
| `border`        | subtle `rgba(255,255,255,0.07)`, strong `rgba(255,255,255,0.13)`                                                                                                        |
| `accent`        | base `#7aa7ff`, muted `rgba(122,167,255,0.16)`                                                                                                                          |
| `section`       | plans `#7aa7ff`, shop `#6fcf97`, recipes `#e8a86b`, pantry `#c79bff`                                                                                                    |
| `accentUtility` | `#9aa4b3` (Food Items, Settings, User Management)                                                                                                                       |
| `state`         | success `#8edcb4` / successMuted `rgba(142,220,180,0.14)`, danger `#e87a8a` / dangerMuted `rgba(232,122,138,0.14)`, warn `#f0c674` / warnMuted `rgba(240,198,116,0.12)` |
| `meal`          | breakfast `#e8c97a`, lunch `#8edcb4`, dinner `#f0a08a`, staples `#c4a7e7`                                                                                               |
| `space`         | xs 4, sm 8, md 12, base 14, lg 16, xl 18, xxl 22, xxxl 24, huge 32                                                                                                      |
| `radius`        | xs 4, sm 6, md 8, lg 10, xl 12, xxl 14, xxxl 16, sheet 18, pill 999                                                                                                     |
| `shadow`        | soft `0 2px 8px rgba(0,0,0,0.12)`, card `0 0 0 3px rgba(122,167,255,0.08)`, sheet `0 -10px 30px rgba(0,0,0,0.4)`, modal `0 24px 60px rgba(0,0,0,0.5)`                   |

Typography scale (design-system.md §Typography) — Task 2/3:

| Variant   | Family  | px  | weight | tracking         |
| --------- | ------- | --- | ------ | ---------------- |
| displayXl | display | 32  | 700    | -0.025em         |
| displayLg | display | 30  | 700    | -0.02em          |
| displayMd | display | 24  | 700    | -0.02em          |
| displaySm | display | 18  | 700    | -0.01em          |
| displayXs | display | 15  | 700    | -0.01em          |
| bodyLg    | body    | 14  | 500    | normal           |
| bodyMd    | body    | 13  | 400    | normal           |
| bodySm    | body    | 12  | 400    | normal           |
| bodyXs    | body    | 11  | 400    | normal           |
| labelMd   | body    | 11  | 700    | 0.14em uppercase |
| labelSm   | body    | 10  | 700    | 0.16em uppercase |
| labelXs   | body    | 9   | 700    | 0.16em uppercase |

---

## File map

**One-time setup (no app code):**

- Modify: `.github/workflows/ci.yml` — add `claude-design-redesign` branch trigger.
- Modify: `.claude/skills/review-code/SKILL.md` — `--base <ref>` override.
- (Manual, user) `.env.local` — point `MONGODB_URI` at `weekly-eats-redesign-local` (cannot be edited by tooling; documented step).

**New app files:**

- `src/lib/design-tokens.ts` (+ `src/lib/__tests__/design-tokens.test.ts`)
- `src/types/mui.d.ts`
- `src/components/ui/Icon.tsx` (+ `src/components/ui/__tests__/Icon.test.tsx`)
- `src/middleware.test.ts` (colocated — `src/` has no `__tests__/` for it)
- `src/components/__tests__/AuthenticatedLayout.test.tsx`

**Modified app files:**

- `src/lib/theme.ts` (rewrite; **keep `responsiveDialogStyle` export** — 16 consumers)
- `src/lib/theme-context.tsx` (simplify to always-dark) + `src/lib/__tests__/theme-context.test.tsx` (rewrite)
- `src/components/ThemeColorMeta.tsx` (hard-code dark)
- `src/components/Providers.tsx` (drop initialMode/initialIsDark)
- `src/app/layout.tsx` (fonts + icon font; drop theme-cookie reads)
- `src/app/globals.css` (body font var → `--font-body`)
- `src/app/page.tsx` (drop `lightTheme` import → single theme)
- `src/app/settings/page.tsx` (placeholder)
- `src/middleware.ts` (server-side approval gate)

---

## Task 0: One-time redesign setup

**Files:**

- Modify: `.github/workflows/ci.yml`
- Modify: `.claude/skills/review-code/SKILL.md`

- [ ] **Step 1: Add the branch to CI triggers**

Edit `.github/workflows/ci.yml` lines 3–7 from:

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

to:

```yaml
on:
  push:
    branches: [main, claude-design-redesign]
  pull_request:
    branches: [main]
```

(Push trigger covers branch pushes; the draft PR's `pull_request` event already fires because its base is `main`.)

- [ ] **Step 2: Add a `--base <ref>` override to `review-code`**

In `.claude/skills/review-code/SKILL.md`, add a row to the Invocation table:

```
| `/review-code --base <ref>`      | Override the diff base (default branch mode = `main`). Combine with any form. Redesign chunks pass the previous chunk tag, e.g. `--base redesign-chunk-00`. |
```

Then in the **Branch mode** setup block, change:

```bash
BASE_REF=main   # branch mode always diffs against main
```

to:

```bash
BASE_REF=main   # branch mode default
# --base <ref> override (redesign chunk reviews pass the previous chunk tag)
if [ -n "$BASE_OVERRIDE" ]; then BASE_REF="$BASE_OVERRIDE"; fi
```

Add one sentence under the Setup heading: "If invoked with `--base <ref>`, set `BASE_OVERRIDE=<ref>` before computing `BASE_REF`; it overrides branch-mode `main` and is ignored in PR mode (PR base wins)." Do not touch the `--post` / `--review-only` / loop control flow.

- [ ] **Step 3: Document the local dev DB step (manual — user runs it)**

`.env.local` is protected (cannot be edited by tooling — `block-env-edit` hook). Surface this instruction to the user and do not attempt to edit the file:

> In `.env.local`, set `MONGODB_URI` to a dedicated local DB, e.g. `mongodb://localhost:27017/weekly-eats-redesign-local`, so `manual-testing` (from Chunk 2 onward) seeds there, never prod. Restart the dev server after changing it.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml .claude/skills/review-code/SKILL.md
git commit -m "chore: redesign one-time setup (CI branch trigger, review-code --base override)"
```

(The draft PR is opened in Task 13 after the first push; the local-dev-DB change is the user's, uncommitted.)

---

## Task 1: Design tokens module

**Files:**

- Create: `src/lib/design-tokens.ts`
- Test: `src/lib/__tests__/design-tokens.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { tokens } from '../design-tokens';

describe('design tokens', () => {
  it('exposes the dark surface ramp', () => {
    expect(tokens.surface.base).toBe('#0f1115');
    expect(tokens.surface.raised).toBe('#181b21');
    expect(tokens.surface.sheet).toBe('#1a1e26');
  });

  it('exposes section accents and the utility accent', () => {
    expect(tokens.section.plans).toBe('#7aa7ff');
    expect(tokens.section.shop).toBe('#6fcf97');
    expect(tokens.section.recipes).toBe('#e8a86b');
    expect(tokens.section.pantry).toBe('#c79bff');
    expect(tokens.accentUtility).toBe('#9aa4b3');
  });

  it('exposes meal domain colors and semantic state colors', () => {
    expect(tokens.meal.breakfast).toBe('#e8c97a');
    expect(tokens.state.danger).toBe('#e87a8a');
    expect(tokens.state.warn).toBe('#f0c674');
  });

  it('exposes numeric spacing/radius scales and shadow strings', () => {
    expect(tokens.space.base).toBe(14);
    expect(tokens.radius.pill).toBe(999);
    expect(tokens.shadow.card).toBe('0 0 0 3px rgba(122,167,255,0.08)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/lib/__tests__/design-tokens.test.ts`
Expected: FAIL — cannot resolve `../design-tokens`.

- [ ] **Step 3: Write the module**

```ts
// src/lib/design-tokens.ts
// Canonical dark-theme design tokens (from docs/design/weekly-eats-redesign/project/design-system.md).
// Light mode is dropped; only dark values live here. The MUI palette in theme.ts is DERIVED from
// these — components consume the section accent via palette.primary (rebound per section in later
// chunks), NOT by importing tokens.section.* directly. Direct token imports are reserved for values
// with no palette home (meal colors, spacing/radii/shadow constants).

export const tokens = {
  surface: {
    base: '#0f1115',
    raised: '#181b21',
    elevated: '#1e222a',
    sunken: '#141619',
    sheet: '#1a1e26',
  },
  text: {
    primary: '#e7e9ee',
    secondary: '#9097a6',
    muted: '#5b6170',
    past: '#7b818f',
  },
  border: {
    subtle: 'rgba(255,255,255,0.07)',
    strong: 'rgba(255,255,255,0.13)',
  },
  accent: {
    base: '#7aa7ff',
    muted: 'rgba(122,167,255,0.16)',
  },
  section: {
    plans: '#7aa7ff',
    shop: '#6fcf97',
    recipes: '#e8a86b',
    pantry: '#c79bff',
  },
  accentUtility: '#9aa4b3',
  state: {
    success: '#8edcb4',
    successMuted: 'rgba(142,220,180,0.14)',
    danger: '#e87a8a',
    dangerMuted: 'rgba(232,122,138,0.14)',
    warn: '#f0c674',
    warnMuted: 'rgba(240,198,116,0.12)',
  },
  meal: {
    breakfast: '#e8c97a',
    lunch: '#8edcb4',
    dinner: '#f0a08a',
    staples: '#c4a7e7',
  },
  space: { xs: 4, sm: 8, md: 12, base: 14, lg: 16, xl: 18, xxl: 22, xxxl: 24, huge: 32 },
  radius: { xs: 4, sm: 6, md: 8, lg: 10, xl: 12, xxl: 14, xxxl: 16, sheet: 18, pill: 999 },
  shadow: {
    soft: '0 2px 8px rgba(0,0,0,0.12)',
    card: '0 0 0 3px rgba(122,167,255,0.08)',
    sheet: '0 -10px 30px rgba(0,0,0,0.4)',
    modal: '0 24px 60px rgba(0,0,0,0.5)',
  },
} as const;

export type DesignTokens = typeof tokens;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/lib/__tests__/design-tokens.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/design-tokens.ts src/lib/__tests__/design-tokens.test.ts
git commit -m "feat: add canonical dark design tokens"
```

---

## Task 2: MUI module augmentation

**Files:**

- Create: `src/types/mui.d.ts`

No standalone unit test (type-only). Verified by `tsc` (the typecheck-on-edit hook + `npm run check`) once Task 3 uses the keys.

- [ ] **Step 1: Write the augmentation**

```ts
// src/types/mui.d.ts
// Custom MUI palette keys + typography variants for the redesign.
import '@mui/material/styles';
import '@mui/material/Typography';

declare module '@mui/material/styles' {
  interface Palette {
    section: { plans: string; shop: string; recipes: string; pantry: string };
    mealColor: { breakfast: string; lunch: string; dinner: string; staples: string };
    accentUtility: string;
  }
  interface PaletteOptions {
    section?: { plans: string; shop: string; recipes: string; pantry: string };
    mealColor?: { breakfast: string; lunch: string; dinner: string; staples: string };
    accentUtility?: string;
  }

  interface TypographyVariants {
    displayXl: React.CSSProperties;
    displayLg: React.CSSProperties;
    displayMd: React.CSSProperties;
    displaySm: React.CSSProperties;
    displayXs: React.CSSProperties;
    bodyLg: React.CSSProperties;
    bodyMd: React.CSSProperties;
    bodySm: React.CSSProperties;
    bodyXs: React.CSSProperties;
    labelMd: React.CSSProperties;
    labelSm: React.CSSProperties;
    labelXs: React.CSSProperties;
  }
  interface TypographyVariantsOptions {
    displayXl?: React.CSSProperties;
    displayLg?: React.CSSProperties;
    displayMd?: React.CSSProperties;
    displaySm?: React.CSSProperties;
    displayXs?: React.CSSProperties;
    bodyLg?: React.CSSProperties;
    bodyMd?: React.CSSProperties;
    bodySm?: React.CSSProperties;
    bodyXs?: React.CSSProperties;
    labelMd?: React.CSSProperties;
    labelSm?: React.CSSProperties;
    labelXs?: React.CSSProperties;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    displayXl: true;
    displayLg: true;
    displayMd: true;
    displaySm: true;
    displayXs: true;
    bodyLg: true;
    bodyMd: true;
    bodySm: true;
    bodyXs: true;
    labelMd: true;
    labelSm: true;
    labelXs: true;
  }
}
```

- [ ] **Step 2: Confirm it's picked up by tsconfig**

`tsconfig.json` `include` already globs `**/*.ts`, so no change needed. Run `npx tsc --noEmit` — expect no new errors (the keys aren't used until Task 3; this step just confirms the file parses).

- [ ] **Step 3: Commit**

```bash
git add src/types/mui.d.ts
git commit -m "feat: augment MUI palette + typography types for redesign tokens"
```

---

## Task 3: Theme bridge rewrite

**Files:**

- Modify: `src/lib/theme.ts` (full rewrite)
- Test: `src/lib/__tests__/theme.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { darkTheme, responsiveDialogStyle } from '../theme';
import { tokens } from '../design-tokens';

describe('darkTheme', () => {
  it('is a dark palette wired to the surface + text tokens', () => {
    expect(darkTheme.palette.mode).toBe('dark');
    expect(darkTheme.palette.background.default).toBe(tokens.surface.base);
    expect(darkTheme.palette.background.paper).toBe(tokens.surface.raised);
    expect(darkTheme.palette.text.primary).toBe(tokens.text.primary);
    expect(darkTheme.palette.divider).toBe(tokens.border.subtle);
  });

  it('defaults primary to the plans section accent', () => {
    expect(darkTheme.palette.primary.main).toBe(tokens.section.plans);
  });

  it('exposes custom palette keys for sections, meals, and the utility accent', () => {
    expect(darkTheme.palette.section.shop).toBe(tokens.section.shop);
    expect(darkTheme.palette.mealColor.dinner).toBe(tokens.meal.dinner);
    expect(darkTheme.palette.accentUtility).toBe(tokens.accentUtility);
  });

  it('maps semantic state colors', () => {
    expect(darkTheme.palette.success.main).toBe(tokens.state.success);
    expect(darkTheme.palette.error.main).toBe(tokens.state.danger);
    expect(darkTheme.palette.warning.main).toBe(tokens.state.warn);
  });

  it('registers a custom typography variant', () => {
    expect(darkTheme.typography.displayLg.fontSize).toBe('30px');
  });

  it('still exports responsiveDialogStyle (16 consumers depend on it)', () => {
    expect(responsiveDialogStyle['& .MuiDialog-paper']).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/lib/__tests__/theme.test.ts`
Expected: FAIL — `darkTheme.palette.section` undefined / primary mismatch / typography variant missing.

- [ ] **Step 3: Rewrite `src/lib/theme.ts`**

Keep the `createThemeOptions` shape (mode param retained but only `'dark'` produced) so re-adding light later is tokens-only. **Remove the `lightTheme` export.** Reference the font CSS vars set in Task 4 (`--font-display`, `--font-body`).

```ts
import { createTheme, ThemeOptions } from '@mui/material/styles';
import { tokens } from './design-tokens';

const display = 'var(--font-display), "Bricolage Grotesque", system-ui, sans-serif';
const body = 'var(--font-body), "Outfit", system-ui, sans-serif';

// Shape preserved (single dark theme for now). Re-adding light later is a tokens-only change.
const createThemeOptions = (_mode: 'dark'): ThemeOptions => ({
  palette: {
    mode: 'dark',
    primary: { main: tokens.section.plans, contrastText: tokens.surface.base },
    secondary: { main: tokens.accentUtility, contrastText: tokens.surface.base },
    background: { default: tokens.surface.base, paper: tokens.surface.raised },
    text: {
      primary: tokens.text.primary,
      secondary: tokens.text.secondary,
      disabled: tokens.text.muted,
    },
    divider: tokens.border.subtle,
    success: { main: tokens.state.success },
    error: { main: tokens.state.danger },
    warning: { main: tokens.state.warn },
    section: { ...tokens.section },
    mealColor: { ...tokens.meal },
    accentUtility: tokens.accentUtility,
  },
  typography: {
    fontFamily: body,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    // Retune standard variants onto the display family for headings.
    h1: { fontFamily: display, fontSize: '30px', fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontFamily: display, fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em' },
    h3: { fontFamily: display, fontSize: '18px', fontWeight: 700, letterSpacing: '-0.01em' },
    h4: { fontFamily: display, fontSize: '15px', fontWeight: 700, letterSpacing: '-0.01em' },
    body1: { fontFamily: body, fontSize: '14px', fontWeight: 500 },
    body2: { fontFamily: body, fontSize: '13px', fontWeight: 400 },
    button: { fontFamily: body, fontSize: '14px', fontWeight: 600, textTransform: 'none' },
    // Custom variants (design-system.md scale).
    displayXl: {
      fontFamily: display,
      fontSize: '32px',
      fontWeight: 700,
      letterSpacing: '-0.025em',
      fontVariantNumeric: 'tabular-nums',
    },
    displayLg: {
      fontFamily: display,
      fontSize: '30px',
      fontWeight: 700,
      letterSpacing: '-0.02em',
      fontVariantNumeric: 'tabular-nums',
    },
    displayMd: {
      fontFamily: display,
      fontSize: '24px',
      fontWeight: 700,
      letterSpacing: '-0.02em',
      fontVariantNumeric: 'tabular-nums',
    },
    displaySm: { fontFamily: display, fontSize: '18px', fontWeight: 700, letterSpacing: '-0.01em' },
    displayXs: { fontFamily: display, fontSize: '15px', fontWeight: 700, letterSpacing: '-0.01em' },
    bodyLg: { fontFamily: body, fontSize: '14px', fontWeight: 500 },
    bodyMd: { fontFamily: body, fontSize: '13px', fontWeight: 400 },
    bodySm: { fontFamily: body, fontSize: '12px', fontWeight: 400 },
    bodyXs: { fontFamily: body, fontSize: '11px', fontWeight: 400 },
    labelMd: {
      fontFamily: body,
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
    },
    labelSm: {
      fontFamily: body,
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
    },
    labelXs: {
      fontFamily: body,
      fontSize: '9px',
      fontWeight: 700,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
    },
  },
  shape: { borderRadius: tokens.radius.md },
  spacing: 8,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: tokens.surface.base, color: tokens.text.primary },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: tokens.radius.md,
          textTransform: 'none',
          fontWeight: 600,
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
        containedPrimary: { color: tokens.surface.base },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.surface.raised,
          backgroundImage: 'none',
          borderRadius: tokens.radius.xxl,
          border: `1px solid ${tokens.border.subtle}`,
          boxShadow: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none', backgroundColor: tokens.surface.raised },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.surface.raised,
          backgroundImage: 'none',
          boxShadow: 'none',
          borderBottom: `1px solid ${tokens.border.subtle}`,
        },
      },
    },
    // tabular-nums on the variants used for counts/qty.
    MuiTypography: {
      styleOverrides: {
        displayXl: { fontVariantNumeric: 'tabular-nums' },
        displayLg: { fontVariantNumeric: 'tabular-nums' },
        displayMd: { fontVariantNumeric: 'tabular-nums' },
        labelMd: { fontVariantNumeric: 'tabular-nums' },
        labelSm: { fontVariantNumeric: 'tabular-nums' },
        labelXs: { fontVariantNumeric: 'tabular-nums' },
      },
    },
  },
});

export const darkTheme = createTheme(createThemeOptions('dark'));

// Reusable responsive dialog styling for full-screen mobile experience.
// PRESERVED — 16 consumers import this from theme.ts; do not remove.
export const responsiveDialogStyle = {
  '& .MuiDialog-paper': {
    margin: { xs: 0, sm: 'auto', md: 'auto', lg: 'auto', xl: 'auto' },
    width: { xs: '100%' },
    height: { xs: '100%', sm: 'auto', md: 'auto', lg: 'auto', xl: 'auto' },
    maxHeight: { xs: '100%', sm: '90vh', md: '90vh', lg: '90vh', xl: '90vh' },
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/lib/__tests__/theme.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Run the broader suite to catch fallout (lightTheme removal)**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/lib/__tests__/theme-context.test.tsx`
Expected: may FAIL — it mocks `lightTheme`/`darkTheme`. Task 5 rewrites it. `tsc` will also flag `page.tsx` (Task 9) and `theme-context.tsx` (Task 5) for the removed `lightTheme` import. These are fixed in their tasks; do not patch them here.

- [ ] **Step 6: Commit**

```bash
git add src/lib/theme.ts src/lib/__tests__/theme.test.ts
git commit -m "feat: rewrite theme.ts as single dark token-bridged theme"
```

---

## Task 4: Fonts + icon webfont in root layout

**Files:**

- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Swap the font loaders in `src/app/layout.tsx`**

Replace the `Figtree` import + instance with Bricolage Grotesque, Outfit, and Material Symbols Outlined. Apply all three CSS-var classes to `<body>`. Drop the theme-cookie reads (always-dark now — coordinate with Task 6/8; the `Providers` no longer takes `initialMode`/`initialIsDark`).

```tsx
import type { Metadata } from 'next';
import { Bricolage_Grotesque, Outfit, Material_Symbols_Outlined } from 'next/font/google';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import './globals.css';
import Providers from '../components/Providers';

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const body = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

// Material Symbols Outlined webfont. Exposed as a CSS var; Icon.tsx applies it as font-family
// plus the required font-variation-settings (next/font generates a hashed class, so we cannot
// rely on the literal `.material-symbols-outlined` class name).
const icons = Material_Symbols_Outlined({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-icons',
  display: 'block',
});

export const metadata: Metadata = {
  title: { template: '%s - Weekly Eats', default: 'Weekly Eats' },
  description: 'Plan your meals, make your list, and head to the store with confidence.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon0.svg', type: 'image/svg+xml' },
      { url: '/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} ${icons.variable}`}>
        <AppRouterCacheProvider>
          <Providers>{children}</Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
```

> **Verification risk (spec §7 "Font load"):** if `Material_Symbols_Outlined` fails to resolve axes via `next/font`, fall back to a stylesheet `<link>` in `<head>` (`https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined`) and keep `--font-icons: 'Material Symbols Outlined'`. Confirm at Step 4 (build) and during manual verification (Task 14) that an icon renders.

- [ ] **Step 2: Update `src/app/globals.css`**

```css
body {
  font-family: var(--font-body), 'Outfit', 'Helvetica', 'Arial', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Hide native number input spinners (up/down arrows) globally */
input[type='number']::-webkit-outer-spin-button,
input[type='number']::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type='number'] {
  -moz-appearance: textfield;
}
```

- [ ] **Step 3: Build to confirm fonts resolve**

Run: `npm run build`
Expected: build succeeds; next/font fetches Bricolage/Outfit/Material Symbols at build time. If the icon font errors, apply the fallback in the Step 1 note. (If build fails with MODULE_NOT_FOUND, `npm run clean` first.)

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat: load Bricolage/Outfit/Material Symbols via next/font; drop Figtree"
```

---

## Task 5: Simplify theme-context to always-dark

**Files:**

- Modify: `src/lib/theme-context.tsx`
- Test: `src/lib/__tests__/theme-context.test.tsx` (rewrite)

Rationale: light mode is dropped. The only `useTheme()` consumer is `ThemeColorMeta` (Task 6 hard-codes dark, dropping that dependency). Collapse the provider to a thin always-dark `ThemeProvider` wrapper, removing: `useSession`-driven settings load, the `themeChange` listener, `mode`/`isDark` state, cookie persistence, and `matchMedia`. **Keep the `User.theme` field and `ThemeMode` type intact** (no schema change) — we only remove the client wiring.

- [ ] **Step 1: Rewrite the test first**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));

vi.mock('@mui/material/styles', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mui-provider">{children}</div>
  ),
  createTheme: () => ({}),
}));

vi.mock('../theme', () => ({ darkTheme: {} }));

import { ThemeProviderWrapper } from '../theme-context';

describe('ThemeProviderWrapper (always dark)', () => {
  it('renders children inside the MUI ThemeProvider', () => {
    const { getByTestId, getByText } = render(
      <ThemeProviderWrapper>
        <span>hello</span>
      </ThemeProviderWrapper>
    );
    expect(getByTestId('mui-provider')).toBeInTheDocument();
    expect(getByText('hello')).toBeInTheDocument();
  });

  it('does not read /api/user/settings (no theme write path)', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(
      <ThemeProviderWrapper>
        <span>x</span>
      </ThemeProviderWrapper>
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/lib/__tests__/theme-context.test.tsx`
Expected: FAIL — old provider imports `lightTheme`, fetches settings, listens for `themeChange`.

- [ ] **Step 3: Rewrite `src/lib/theme-context.tsx`**

```tsx
'use client';

import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { darkTheme } from './theme';

// Light mode is dropped (plumbing preserved elsewhere: User.theme field + ThemeMode type stay).
// This wrapper is intentionally thin — always dark, no toggle, no settings fetch, no cookies.
export function ThemeProviderWrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider theme={darkTheme}>{children}</ThemeProvider>;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/lib/__tests__/theme-context.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/theme-context.tsx src/lib/__tests__/theme-context.test.tsx
git commit -m "refactor: collapse theme-context to always-dark; drop toggle/cookie/themeChange wiring"
```

---

## Task 6: Hard-code ThemeColorMeta to dark

**Files:**

- Modify: `src/components/ThemeColorMeta.tsx`
- Test: `src/components/__tests__/ThemeColorMeta.test.tsx` (create if absent — check first)

- [ ] **Step 1: Check for an existing test**

Run: `ls src/components/__tests__/ThemeColorMeta.test.tsx 2>/dev/null || echo none`
If present, update its expectation to the dark surface color; if absent, create the test below.

- [ ] **Step 2: Write/adjust the test**

```tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ThemeColorMeta } from '../ThemeColorMeta';

afterEach(cleanup);

describe('ThemeColorMeta', () => {
  it('sets the theme-color meta tag to the dark surface base', () => {
    render(<ThemeColorMeta />);
    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta?.getAttribute('content')).toBe('#0f1115');
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/__tests__/ThemeColorMeta.test.tsx`
Expected: FAIL — component imports `useTheme` (now removed) → throws / wrong color.

- [ ] **Step 4: Rewrite `src/components/ThemeColorMeta.tsx`**

```tsx
'use client';

import { useEffect } from 'react';
import { tokens } from '../lib/design-tokens';

/**
 * Sets the theme-color meta tag for the OS/PWA status bar. Dark-only now
 * (light mode dropped); hard-coded to the dark surface base.
 */
export const ThemeColorMeta: React.FC = () => {
  useEffect(() => {
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', tokens.surface.base);
  }, []);

  return null;
};
```

- [ ] **Step 5: Run to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/__tests__/ThemeColorMeta.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ThemeColorMeta.tsx src/components/__tests__/ThemeColorMeta.test.tsx
git commit -m "refactor: hard-code ThemeColorMeta to dark surface"
```

---

## Task 7: Simplify Providers (drop initial mode props)

**Files:**

- Modify: `src/components/Providers.tsx`

- [ ] **Step 1: Rewrite `src/components/Providers.tsx`**

```tsx
'use client';

import { SessionProvider } from 'next-auth/react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProviderWrapper } from '../lib/theme-context';
import { ThemeColorMeta } from './ThemeColorMeta';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProviderWrapper>
        <CssBaseline />
        <ThemeColorMeta />
        {children}
      </ThemeProviderWrapper>
    </SessionProvider>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors from `Providers`/`layout` (layout already updated in Task 4 to call `<Providers>` with no mode props). Remaining errors should only be `page.tsx` (Task 9) and `settings/page.tsx` (Task 11) if not yet done.

- [ ] **Step 3: Commit**

```bash
git add src/components/Providers.tsx
git commit -m "refactor: drop theme-mode props from Providers (always dark)"
```

---

## Task 8: Icon component

**Files:**

- Create: `src/components/ui/Icon.tsx`
- Test: `src/components/ui/__tests__/Icon.test.tsx`

Renders a Material Symbols ligature. **Decorative by default** (`aria-hidden`): the ligature text would otherwise be announced by screen readers. Icon-only buttons supply their own `aria-label` on the button (enforced per chunk by `review-code`'s a11y reviewer).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Icon } from '../Icon';

afterEach(cleanup);

describe('Icon', () => {
  it('renders the ligature name as text content', () => {
    const { container } = render(<Icon name="kitchen" />);
    expect(container.textContent).toBe('kitchen');
  });

  it('is decorative (aria-hidden) by default', () => {
    const { container } = render(<Icon name="delete" />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies the icon font var and size', () => {
    const { container } = render(<Icon name="add" size={20} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.fontSize).toBe('20px');
    expect(el.style.fontFamily).toContain('--font-icons');
  });

  it('reflects the fill axis in font-variation-settings', () => {
    const { container } = render(<Icon name="star" fill />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.fontVariationSettings).toContain("'FILL' 1");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/ui/__tests__/Icon.test.tsx`
Expected: FAIL — cannot resolve `../Icon`.

- [ ] **Step 3: Write `src/components/ui/Icon.tsx`**

```tsx
'use client';

import * as React from 'react';

export interface IconProps {
  /** Material Symbols ligature name (snake_case), e.g. "kitchen", "shopping_cart". */
  name: string;
  /** Font size in px (also drives the optical-size axis). Default 24. */
  size?: number;
  /** CSS color. Defaults to inherit (`currentColor`). */
  color?: string;
  /** Filled vs outlined (FILL axis). Default false (outlined). */
  fill?: boolean;
  /** Stroke weight (wght axis), 100–700. Default 400. */
  weight?: number;
  /** Provide only for standalone meaningful icons; defaults to decorative (aria-hidden). */
  'aria-label'?: string;
  className?: string;
  sx?: React.CSSProperties;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  color = 'inherit',
  fill = false,
  weight = 400,
  className,
  sx,
  'aria-label': ariaLabel,
}) => {
  const decorative = ariaLabel === undefined;
  return (
    <span
      className={className}
      aria-hidden={decorative ? true : undefined}
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
      style={{
        fontFamily: 'var(--font-icons)',
        fontWeight: 'normal',
        fontStyle: 'normal',
        fontSize: `${size}px`,
        lineHeight: 1,
        letterSpacing: 'normal',
        textTransform: 'none',
        display: 'inline-flex',
        whiteSpace: 'nowrap',
        wordWrap: 'normal',
        direction: 'ltr',
        color,
        WebkitFontSmoothing: 'antialiased',
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${size}`,
        ...sx,
      }}
    >
      {name}
    </span>
  );
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/ui/__tests__/Icon.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Icon.tsx src/components/ui/__tests__/Icon.test.tsx
git commit -m "feat: add Material Symbols Icon component (decorative by default)"
```

---

## Task 9: Fix the landing page's light-theme dependency

**Files:**

- Modify: `src/app/page.tsx`

The signed-out landing page imports `lightTheme` (removed in Task 3) and wraps content in `<ThemeProvider theme={lightTheme}>`. Chunk 10 redesigns this page; for now make it compile and render dark. Minimal change — do not restyle.

- [ ] **Step 1: Swap the import and both usages**

In `src/app/page.tsx`:

- Change `import { lightTheme } from '../lib/theme';` → `import { darkTheme } from '../lib/theme';`
- Change both `<ThemeProvider theme={lightTheme}>` occurrences → `<ThemeProvider theme={darkTheme}>`

- [ ] **Step 2: Verify the existing landing-page test still passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/app/__tests__/page.test.tsx 2>/dev/null || echo "no page test"`
Expected: PASS or "no page test". If it asserted light colors, update to dark equivalents.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: the `page.tsx` `lightTheme` error is gone.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "fix: point signed-out landing page at darkTheme (light mode dropped)"
```

---

## Task 10: Settings placeholder page

**Files:**

- Modify: `src/app/settings/page.tsx` (replace body)
- Test: `src/app/settings/__tests__/page.test.tsx` (create if absent; otherwise rewrite)

Per spec §2: route stays and direct URL works; renders a placeholder ("Nothing to settle right now — light mode will return"). Removes the theme `Select`, the `defaultMealPlanOwner` UI, and the `themeChange` dispatch. (The old nav still links here in Chunk 1; the avatar-menu Settings link is dropped in Chunk 2's nav rewrite.)

- [ ] **Step 1: Replace `src/app/settings/page.tsx`**

```tsx
'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Container, Typography, Box, Paper, CircularProgress } from '@mui/material';
import AuthenticatedLayout from '../../components/AuthenticatedLayout';

export default function SettingsPage() {
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="xl" sx={{ py: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      </AuthenticatedLayout>
    );
  }

  if (status === 'unauthenticated') {
    redirect('/');
  }

  return (
    <AuthenticatedLayout>
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Paper elevation={0} sx={{ p: 6, borderRadius: 3, textAlign: 'center' }}>
          <Typography variant="h4" component="h1" color="primary.main" gutterBottom>
            Settings
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Nothing to settle right now — light mode will return.
          </Typography>
        </Paper>
      </Container>
    </AuthenticatedLayout>
  );
}
```

- [ ] **Step 2: Write/replace the test**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { email: 'me@example.com' } }, status: 'authenticated' }),
}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../../../components/AuthenticatedLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import SettingsPage from '../page';

afterEach(cleanup);

describe('SettingsPage (placeholder)', () => {
  it('renders the placeholder copy and no theme selector', () => {
    render(<SettingsPage />);
    expect(screen.getByText(/light mode will return/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/theme/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/app/settings/__tests__/page.test.tsx`
Expected: PASS. (Adjust the `AuthenticatedLayout` mock relative path to match the test's depth.)

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/page.tsx src/app/settings/__tests__/page.test.tsx
git commit -m "feat: replace Settings page with dark-mode placeholder"
```

---

## Task 11: Interim server-side approval gate in middleware

**Files:**

- Modify: `src/middleware.ts`
- Test: `src/middleware.test.ts` (create)

Spec §1 / §7: add a server-side `token.isApproved` (+ `isAdmin`) check so a valid session cookie can't bypass the client gate on the public beta. Admins are exempt (mirrors `use-approval-status` logic). Unapproved page navigations → redirect `/pending-approval`; unapproved `/api/*` calls → 403 JSON; the approval-status poll and the pending page itself stay reachable so an approved-mid-session user can be un-gated by the client hook.

- [ ] **Step 1: Confirm the error constant exists**

Run: `grep -n "FORBIDDEN" src/lib/errors.ts`
Expected: `AUTH_ERRORS.FORBIDDEN` defined. Use it (don't hardcode the string).

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth/jwt', () => ({ getToken: vi.fn() }));

const { getToken } = await import('next-auth/jwt');
const { middleware } = await import('./middleware');

const req = (path: string) => new NextRequest(new URL(`http://localhost${path}`));

beforeEach(() => {
  (getToken as any).mockReset();
});

describe('middleware approval gating', () => {
  it('lets the public home page through without a token', async () => {
    const res = await middleware(req('/'));
    expect(res.status).toBe(200); // NextResponse.next()
  });

  it('redirects unauthenticated users to / with a callbackUrl', async () => {
    (getToken as any).mockResolvedValueOnce(null);
    const res = await middleware(req('/meal-plans'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/');
    expect(res.headers.get('location')).toContain('callbackUrl=%2Fmeal-plans');
  });

  it('lets an approved user reach protected pages', async () => {
    (getToken as any).mockResolvedValueOnce({ isApproved: true, isAdmin: false });
    const res = await middleware(req('/meal-plans'));
    expect(res.status).toBe(200);
  });

  it('lets an admin through even if not approved', async () => {
    (getToken as any).mockResolvedValueOnce({ isApproved: false, isAdmin: true });
    const res = await middleware(req('/user-management'));
    expect(res.status).toBe(200);
  });

  it('redirects an unapproved non-admin to /pending-approval', async () => {
    (getToken as any).mockResolvedValueOnce({ isApproved: false, isAdmin: false });
    const res = await middleware(req('/meal-plans'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/pending-approval');
  });

  it('does not loop when the unapproved user is already on /pending-approval', async () => {
    (getToken as any).mockResolvedValueOnce({ isApproved: false, isAdmin: false });
    const res = await middleware(req('/pending-approval'));
    expect(res.status).toBe(200);
  });

  it('lets the unapproved user poll the approval-status API', async () => {
    (getToken as any).mockResolvedValueOnce({ isApproved: false, isAdmin: false });
    const res = await middleware(req('/api/user/approval-status'));
    expect(res.status).toBe(200);
  });

  it('returns 403 JSON (not an HTML redirect) for other API calls by unapproved users', async () => {
    (getToken as any).mockResolvedValueOnce({ isApproved: false, isAdmin: false });
    const res = await middleware(req('/api/meal-plans'));
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/middleware.test.ts`
Expected: FAIL — current middleware has no approval branch (the 403 / pending-approval cases fail).

- [ ] **Step 4: Update `src/middleware.ts`**

Insert the approval gate after the existing `if (!token)` block, before the final `return NextResponse.next()`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { AUTH_ERRORS } from '@/lib/errors';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === '/' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname === '/manifest.json' ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    if (pathname !== '/') {
      url.searchParams.set('callbackUrl', pathname);
    }
    return NextResponse.redirect(url);
  }

  // Interim server-side approval gate (beta runs against the shared prod DB).
  // Admins are exempt; mirrors the client-side use-approval-status logic.
  const isApproved = token.isApproved === true || token.isAdmin === true;
  if (!isApproved) {
    // Keep the approval poll + the pending page reachable so an approved-mid-session
    // user can still be un-gated by the client hook.
    if (pathname === '/pending-approval' || pathname === '/api/user/approval-status') {
      return NextResponse.next();
    }
    // Don't redirect API calls to an HTML page — return a JSON 403.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: AUTH_ERRORS.FORBIDDEN }, { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/pending-approval';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
```

- [ ] **Step 5: Run to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/middleware.test.ts`
Expected: PASS (8 tests). If `NextResponse.next()` reports a status other than 200 in this jsdom/runtime, assert on the absence of a `location` header / `res.headers.get('x-middleware-next')` instead — adjust assertions to the runtime's representation, keeping the behavioral intent.

- [ ] **Step 6: Commit**

```bash
git add src/middleware.ts src/middleware.test.ts
git commit -m "feat: interim server-side approval gate in middleware (closes #83)"
```

---

## Task 12: Lock the client approval-gate mount with a test

**Files:**

- Create: `src/components/__tests__/AuthenticatedLayout.test.tsx`

Spec §1: treat the client approval-gate mount as load-bearing so Chunk 2's `AuthenticatedLayout` rewrite can't silently drop it. The test asserts `AuthenticatedLayout` invokes `useApprovalStatus`.

- [ ] **Step 1: Write the test**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const useApprovalStatusMock = vi.fn(() => ({ isRedirecting: false }));
vi.mock('../../lib/use-approval-status', () => ({
  useApprovalStatus: useApprovalStatusMock,
}));
vi.mock('../Header', () => ({ default: () => <div data-testid="header" /> }));
vi.mock('../BottomNav', () => ({ default: () => <div data-testid="bottomnav" /> }));

import AuthenticatedLayout from '../AuthenticatedLayout';

afterEach(() => {
  cleanup();
  useApprovalStatusMock.mockClear();
});

describe('AuthenticatedLayout', () => {
  it('mounts the approval-status gate (load-bearing — must survive the Chunk 2 rewrite)', () => {
    render(
      <AuthenticatedLayout>
        <span>content</span>
      </AuthenticatedLayout>
    );
    expect(useApprovalStatusMock).toHaveBeenCalled();
  });

  it('renders children when not redirecting', () => {
    const { getByText } = render(
      <AuthenticatedLayout>
        <span>content</span>
      </AuthenticatedLayout>
    );
    expect(getByText('content')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/__tests__/AuthenticatedLayout.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 3: Commit**

```bash
git add src/components/__tests__/AuthenticatedLayout.test.tsx
git commit -m "test: lock AuthenticatedLayout approval-gate mount as load-bearing"
```

---

## Task 13: Full validation + open the draft PR

**Files:** none (CI/PR orchestration).

- [ ] **Step 1: Full check**

Run: `npm run check`
Expected: lint + test + build all green. If MODULE_NOT_FOUND, `npm run clean` then retry. Fix any fallout (most likely: a test that referenced the removed `lightTheme`, the old settings selector, or Figtree).

- [ ] **Step 2: Push the branch**

```bash
git push -u origin claude-design-redesign
```

- [ ] **Step 3: Open the long-lived draft PR (one-time)**

```bash
gh pr create --draft --base main --head claude-design-redesign \
  --title "Design redesign (dark-first) — long-lived integration PR" \
  --body "$(cat <<'EOF'
Long-lived **draft** integration PR for the dark-first redesign migration. Lands surface-by-surface in chunks; stays in draft until the final squash merge.

- Spec: `docs/superpowers/specs/2026-05-28-design-redesign-migration-design.md`
- Progress ledger: `docs/superpowers/plans/redesign-progress.md`

Per-chunk manual-test checklists are posted as their own slot comments (from Chunk 2 onward).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Record the PR URL in the ledger (Draft PR line + Chunk 1 row). Confirm CI runs against it.

---

## Task 14: Chunk-scoped review + manual verification + close-out

Follows the per-chunk loop (spec §5), steps 2–9. Chunk 1 has UI (tokens/fonts visibly change every screen), so it gets manual verification.

- [ ] **Step 1: `review-code` scoped to this chunk**

Invoke: `/review-code --base main` (Chunk 1's base is `main` per spec §5; later chunks use the prior tag). Let the auto-fix loop run; commit fixes locally. Re-run `npm run check` after fixes.

- [ ] **Step 2: Manual verification (localhost + local dev DB)**

Per CLAUDE.md, authenticated pages need **Claude in Chrome** (Google OAuth). Verify on `npm run dev`:

- App loads dark; no flash of light theme.
- Bricolage on headings, Outfit on body; numerals are tabular.
- An `Icon` renders (spot-check via a temporary mount or the existing screens — note call-site migration is later, so most icons are still `@mui/icons-material`, which is expected/fine).
- `/settings` shows the placeholder; direct URL works.
- Unapproved-account gating: a non-approved session is redirected to `/pending-approval` on protected routes (server-side). Approved/admin unaffected. (Test with care against the **local** DB.)
- Smoke the signed-out landing page (`preview_*` is fine here — unauthenticated): renders dark, sign-in button present.

- [ ] **Step 3: Fold any fixes into the chunk; re-run `npm run check`.**

- [ ] **Step 4: Tag + ledger + close #83**

```bash
git tag redesign-chunk-01
git push origin redesign-chunk-01
gh issue close 83 --comment "Interim server-side approval gate landed in Chunk 1 (src/middleware.ts) with tests; closing per redesign plan."
```

Update `docs/superpowers/plans/redesign-progress.md`: mark Chunk 1 `done`, fill in the tag / plan-doc / PR-comment / date columns, point "Next up" at Chunk 2 (Nav chrome), and append any carryovers (e.g. icon-font loading approach chosen, any review-code findings deferred).

- [ ] **Step 5: Merge `main` → branch if main moved; then compact (spec §9).**

---

## Self-Review (writing-plans)

**Spec coverage (§2 Foundation + §1 setup):**

- Tokens (`design-tokens.ts`) → Task 1. ✓
- Theme bridge + `responsiveDialogStyle` preserved → Task 3. ✓
- Drop light mode (single theme fn shape kept, `theme-context` always-dark, `User.theme` intact, `ThemeColorMeta` dark, toggle UI removed, `themeChange`/settings-write coupling removed) → Tasks 3/5/6/7/10. ✓
- Typography (Bricolage/Outfit via next/font, scale → variants, tabular-nums) → Tasks 2/3/4. ✓
- Icons (Material Symbols via next/font, `Icon.tsx`, decorative-by-default a11y rule) → Tasks 4/8. ✓
- TypeScript module augmentation (`mui.d.ts`) → Task 2. ✓
- Per-section accent plumbing → **explicitly deferred to Chunk 2/3+** (scope boundary). Default `primary` = `section.plans` and custom palette keys populated now. ✓ (documented deferral)
- One-time setup: draft PR (Task 13), `review-code` base override (Task 0), CI branch trigger (Task 0), local dev DB (Task 0 manual), ledger (already in-progress; finalized Task 14). ✓
- Server-side approval gate (§1/§7) → Task 11 + client-gate lock Task 12. ✓

**Placeholder scan:** no TBD/"add error handling"/"similar to Task N" — all code is inline. ✓

**Type consistency:** `tokens` shape (Task 1) ↔ `mui.d.ts` keys (Task 2) ↔ `theme.ts` palette/typography (Task 3) all use `section`/`mealColor`(palette key)↔`tokens.meal`/`accentUtility`. Note: palette key is `mealColor` (MUI reserves `meal`? no — chosen `mealColor` to avoid collision and read clearly); tokens key is `meal`. The theme maps `mealColor: { ...tokens.meal }`. Consistent across Tasks 2/3. ✓ `ThemeProviderWrapper` prop signature reduced to `{ children }` in Task 5 and called that way in Task 7. ✓ `Providers` prop signature reduced in Task 7 and called in Task 4 layout. ✓

**Known cross-task ordering hazard:** Task 3 removes `lightTheme`, which transiently breaks `theme-context.tsx` (Task 5) and `page.tsx` (Task 9) until those run. Tasks are ordered 3 → 5 → 9 and each ends green; only run `npm run check` (full) at Task 13 after all are done. Per-task `npx vitest run <file>` stays scoped so the transient breakage doesn't block individual task completion.
