# Chunk 2 — Nav Chrome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old MUI `Header`/`BottomNav` with the redesign's dark nav chrome (`TopNav`, `BottomNav`, `AppIcon`, `NavAvatar`, `AvatarMenu`), backed by a single shared section-detection helper + hook, and centralize per-section accent theming + the approval gate in `AuthenticatedLayout`.

**Architecture:** A pure `getSectionForPath` helper + `useActiveSection` hook own active-section detection (today duplicated in `Header`/`BottomNav`). New `src/components/nav/*` render the chrome with named exports. `SectionThemeProvider` rebinds `palette.primary` to the active section accent and is wired **once, centrally** in `AuthenticatedLayout` (keyed off the pathname) rather than per route-layout — this sidesteps the §2 server-layout/`metadata` nesting constraint and means surface chunks 3–6 just consume `palette.primary`. `AuthenticatedLayout` also absorbs the unapproved-user redirect that `Header` used to own, so the client approval gate stays load-bearing.

**Tech Stack:** Next.js 15 App Router, React 19, MUI v7 (`sx`, `styled`, `useTheme`/`createTheme`), next-auth `useSession`, Vitest + RTL.

**Spec refs:** §3 (Nav chrome), §2 (per-section accent plumbing, nesting constraint), §1 (beta access gating / client gate mount), `docs/design/weekly-eats-redesign/project/nav-chrome.jsx` (canonical).

---

## File Structure

| File                                                    | Responsibility                                                                         | New/Modify |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------- |
| `src/lib/nav-sections.ts`                               | `NAV_SECTIONS` config + `getSectionForPath` pure helper + `SectionKey` type            | Create     |
| `src/lib/hooks/use-active-section.ts`                   | `useActiveSection()` = `getSectionForPath(usePathname())`                              | Create     |
| `src/lib/hooks/index.ts`                                | export `useActiveSection`                                                              | Modify     |
| `src/components/nav/SectionThemeProvider.tsx`           | Rebinds `palette.primary` to active section accent (accentUtility for system pages)    | Create     |
| `src/components/nav/AppIcon.tsx`                        | BM-α logomark SVG; `squircled` prop for marketing                                      | Create     |
| `src/components/nav/NavAvatar.tsx`                      | Initials avatar (gradient)                                                             | Create     |
| `src/components/nav/AvatarMenu.tsx`                     | Dropdown (desktop) / bottom sheet (mobile) menu                                        | Create     |
| `src/components/nav/TopNav.tsx`                         | Desktop top bar                                                                        | Create     |
| `src/components/nav/BottomNav.tsx`                      | Mobile bottom bar (4 slots, no Pantry)                                                 | Create     |
| `src/components/AuthenticatedLayout.tsx`                | Render new chrome; central `SectionThemeProvider`; unapproved redirect                 | Modify     |
| `src/components/Header.tsx`                             | —                                                                                      | **Delete** |
| `src/components/BottomNav.tsx`                          | —                                                                                      | **Delete** |
| `src/components/__tests__/AuthenticatedLayout.test.tsx` | Keep load-bearing gate assertion; update mocks for new chrome; add redirect/hide cases | Modify     |
| `src/lib/__tests__/nav-sections.test.ts`                | helper tests                                                                           | Create     |
| `src/lib/hooks/__tests__/use-active-section.test.tsx`   | hook test                                                                              | Create     |
| `src/components/nav/__tests__/*.test.tsx`               | per-component tests                                                                    | Create     |

**Naming:** all new `nav/*` files use **named exports** (CLAUDE.md). The deleted `Header.tsx`/`BottomNav.tsx` used `export default` — do not carry that forward.

**Decisions baked in (record in ledger at close):**

- **NavAvatar shows initials, not the Google profile photo** (spec §3: "initials avatar"; nav-chrome.jsx uses an initials gradient). This orphans `CachedAvatar` (only `Header`/`BottomNav` used it) → flag for Chunk 11 cleanup; do **not** delete it this chunk (avoid touching unrelated surfaces).
- **`SectionThemeProvider` wired centrally in `AuthenticatedLayout`** (not per route-layout). Deviation from §2's per-layout sketch / §4's "chunks 3–6" note — same effect, DRYer, sidesteps the client-component-as-layout constraint. Chunks 3–6 consume `palette.primary`; no per-layout wiring needed.
- **Approval redirect moves from `Header` → `AuthenticatedLayout`.** Consolidates the scattered `Header`+`BottomNav` approval logic into the one mount the spec calls load-bearing.

---

### Task 1: Section config + `getSectionForPath` helper

**Files:**

- Create: `src/lib/nav-sections.ts`
- Test: `src/lib/__tests__/nav-sections.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/nav-sections.test.ts
import { describe, it, expect } from 'vitest';
import { getSectionForPath, NAV_SECTIONS } from '../nav-sections';

describe('getSectionForPath', () => {
  it.each([
    ['/meal-plans', 'plans'],
    ['/meal-plans/abc123', 'plans'],
    ['/shopping-lists', 'shop'],
    ['/shopping-lists/xyz', 'shop'],
    ['/recipes', 'recipes'],
    ['/recipes/42', 'recipes'],
    ['/pantry', 'pantry'],
    ['/pantry/whatever', 'pantry'],
  ])('maps %s -> %s', (path, expected) => {
    expect(getSectionForPath(path)).toBe(expected);
  });

  it.each([
    '/food-items',
    '/user-management',
    '/settings',
    '/pending-approval',
    '/',
    '/mealplansX',
  ])('returns null for system/non-section path %s', (path) => {
    expect(getSectionForPath(path)).toBeNull();
  });

  it('returns null for null pathname', () => {
    expect(getSectionForPath(null)).toBeNull();
  });
});

describe('NAV_SECTIONS', () => {
  it('has the four sections in order with hrefs + icons', () => {
    expect(NAV_SECTIONS.map((s) => s.key)).toEqual(['plans', 'shop', 'recipes', 'pantry']);
    expect(NAV_SECTIONS.map((s) => s.href)).toEqual([
      '/meal-plans',
      '/shopping-lists',
      '/recipes',
      '/pantry',
    ]);
    expect(NAV_SECTIONS.every((s) => s.icon && s.color && s.label)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/lib/__tests__/nav-sections.test.ts`
Expected: FAIL — `Cannot find module '../nav-sections'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/nav-sections.ts
// Single source of truth for the four nav sections + active-section detection.
// Previously duplicated in Header.tsx and BottomNav.tsx; collapsed here per spec §3.
import { tokens } from './design-tokens';

export type SectionKey = 'plans' | 'shop' | 'recipes' | 'pantry';

export interface NavSection {
  key: SectionKey;
  label: string;
  href: string;
  /** Material Symbols ligature name (consumed by ui/Icon). */
  icon: string;
  /** Section accent color (from design tokens). */
  color: string;
}

export const NAV_SECTIONS: NavSection[] = [
  {
    key: 'plans',
    label: 'Plans',
    href: '/meal-plans',
    icon: 'calendar_month',
    color: tokens.section.plans,
  },
  {
    key: 'shop',
    label: 'Shop',
    href: '/shopping-lists',
    icon: 'shopping_cart',
    color: tokens.section.shop,
  },
  {
    key: 'recipes',
    label: 'Recipes',
    href: '/recipes',
    icon: 'restaurant',
    color: tokens.section.recipes,
  },
  {
    key: 'pantry',
    label: 'Pantry',
    href: '/pantry',
    icon: 'kitchen',
    color: tokens.section.pantry,
  },
];

/** Map a pathname to its top-level section, or null for system/non-section pages. */
export function getSectionForPath(pathname: string | null): SectionKey | null {
  if (!pathname) return null;
  for (const s of NAV_SECTIONS) {
    if (pathname === s.href || pathname.startsWith(`${s.href}/`)) return s.key;
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/lib/__tests__/nav-sections.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/nav-sections.ts src/lib/__tests__/nav-sections.test.ts
git commit -m "feat(nav): shared section config + getSectionForPath helper"
```

---

### Task 2: `useActiveSection` hook

**Files:**

- Create: `src/lib/hooks/use-active-section.ts`
- Modify: `src/lib/hooks/index.ts`
- Test: `src/lib/hooks/__tests__/use-active-section.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/lib/hooks/__tests__/use-active-section.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { usePathnameMock } = vi.hoisted(() => ({ usePathnameMock: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: usePathnameMock }));

import { useActiveSection } from '../use-active-section';

beforeEach(() => usePathnameMock.mockReset());

describe('useActiveSection', () => {
  it('derives the section from the current pathname', () => {
    usePathnameMock.mockReturnValue('/recipes/123');
    const { result } = renderHook(() => useActiveSection());
    expect(result.current).toBe('recipes');
  });

  it('returns null on a system page', () => {
    usePathnameMock.mockReturnValue('/food-items');
    const { result } = renderHook(() => useActiveSection());
    expect(result.current).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/lib/hooks/__tests__/use-active-section.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/hooks/use-active-section.ts
'use client';

import { usePathname } from 'next/navigation';
import { getSectionForPath, type SectionKey } from '../nav-sections';

/** The active top-level section for the current route, or null for system pages. */
export function useActiveSection(): SectionKey | null {
  return getSectionForPath(usePathname());
}
```

Add to `src/lib/hooks/index.ts` (append):

```ts
export { useActiveSection } from './use-active-section';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/lib/hooks/__tests__/use-active-section.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hooks/use-active-section.ts src/lib/hooks/index.ts src/lib/hooks/__tests__/use-active-section.test.tsx
git commit -m "feat(nav): useActiveSection hook"
```

---

### Task 3: `SectionThemeProvider`

Rebinds `palette.primary.main` to the active section accent (or `accentUtility` for system pages) by extending the inherited theme. Wraps surface content so `color="primary"` resolves to the section accent in chunks 3–6.

**Files:**

- Create: `src/components/nav/SectionThemeProvider.tsx`
- Test: `src/components/nav/__tests__/SectionThemeProvider.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/nav/__tests__/SectionThemeProvider.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useTheme } from '@mui/material/styles';
import { tokens } from '@/lib/design-tokens';

const { useActiveSectionMock } = vi.hoisted(() => ({ useActiveSectionMock: vi.fn() }));
vi.mock('@/lib/hooks/use-active-section', () => ({ useActiveSection: useActiveSectionMock }));

import { SectionThemeProvider } from '../SectionThemeProvider';

function PrimaryProbe() {
  const theme = useTheme();
  return <span data-testid="primary">{theme.palette.primary.main}</span>;
}

beforeEach(() => useActiveSectionMock.mockReset());

describe('SectionThemeProvider', () => {
  it('rebinds primary to the section accent', () => {
    useActiveSectionMock.mockReturnValue('recipes');
    const { getByTestId } = render(
      <SectionThemeProvider>
        <PrimaryProbe />
      </SectionThemeProvider>
    );
    expect(getByTestId('primary').textContent).toBe(tokens.section.recipes);
  });

  it('binds the utility accent on system pages (null section)', () => {
    useActiveSectionMock.mockReturnValue(null);
    const { getByTestId } = render(
      <SectionThemeProvider>
        <PrimaryProbe />
      </SectionThemeProvider>
    );
    expect(getByTestId('primary').textContent).toBe(tokens.accentUtility);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/nav/__tests__/SectionThemeProvider.test.tsx`
Expected: FAIL — module not found. (Note: with no outer `ThemeProvider`, `useTheme` returns MUI's default theme, which `createTheme(theme, …)` still extends correctly.)

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/nav/SectionThemeProvider.tsx
'use client';

import { useMemo } from 'react';
import { ThemeProvider, useTheme, createTheme } from '@mui/material/styles';
import { tokens } from '@/lib/design-tokens';
import { useActiveSection } from '@/lib/hooks/use-active-section';

/**
 * Rebinds palette.primary to the active section's accent so MUI components using
 * color="primary" resolve to the section color. System pages (no active section)
 * bind the cool-slate utility accent. Wired centrally from AuthenticatedLayout.
 */
export function SectionThemeProvider({ children }: { children: React.ReactNode }) {
  const base = useTheme();
  const section = useActiveSection();
  const accent = section ? tokens.section[section] : tokens.accentUtility;

  const theme = useMemo(
    () =>
      createTheme(base, {
        palette: { primary: { main: accent, contrastText: tokens.surface.base } },
      }),
    [base, accent]
  );

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/nav/__tests__/SectionThemeProvider.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/nav/SectionThemeProvider.tsx src/components/nav/__tests__/SectionThemeProvider.test.tsx
git commit -m "feat(nav): SectionThemeProvider rebinds primary to section accent"
```

---

### Task 4: `AppIcon`

Port the BM-α logomark from `nav-chrome.jsx` (bowl + four colored meal blocks). `squircled` prop wraps it in a black squircle background (marketing/home, used in Chunk 10); default is the bare logomark used in nav.

**Files:**

- Create: `src/components/nav/AppIcon.tsx`
- Test: `src/components/nav/__tests__/AppIcon.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/nav/__tests__/AppIcon.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AppIcon } from '../AppIcon';

describe('AppIcon', () => {
  it('renders an svg logomark with four meal blocks', () => {
    const { container } = render(<AppIcon size={30} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('width')).toBe('30');
    // four colored blocks
    expect(container.querySelectorAll('rect[rx="1"]').length).toBe(4);
  });

  it('is decorative (aria-hidden) by default', () => {
    const { container } = render(<AppIcon />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('squircled variant adds a background rect', () => {
    const { container } = render(<AppIcon squircled />);
    // squircle background rect uses a large rx (rounded square)
    expect(container.querySelector('rect[data-squircle="true"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/nav/__tests__/AppIcon.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/nav/AppIcon.tsx
import { tokens } from '@/lib/design-tokens';

const BLOCKS = [
  { color: tokens.section.plans, x: 12, w: 32 },
  { color: tokens.section.recipes, x: 16, w: 36 },
  { color: tokens.section.shop, x: 12, w: 26 },
  { color: tokens.section.pantry, x: 18, w: 32 },
];

export interface AppIconProps {
  size?: number;
  /** Wrap the logomark in a black squircle background (marketing/home). */
  squircled?: boolean;
}

export function AppIcon({ size = 30, squircled = false }: AppIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {squircled && (
        <rect data-squircle="true" x="0" y="0" width="64" height="64" rx="16" fill="#000" />
      )}
      {BLOCKS.map((b, i) => (
        <rect key={i} x={b.x} y={12 + i * 8} width={b.w} height="5" rx="1" fill={b.color} />
      ))}
      <path d="M 8 47 L 56 47 Q 56 56 32 56 Q 8 56 8 47 Z" fill="#3a3d44" />
      <rect x="8" y="47" width="48" height="1.5" fill="rgba(255,255,255,0.20)" />
    </svg>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/nav/__tests__/AppIcon.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/nav/AppIcon.tsx src/components/nav/__tests__/AppIcon.test.tsx
git commit -m "feat(nav): AppIcon logomark (BM-alpha)"
```

---

### Task 5: `NavAvatar`

Initials avatar with the nav-chrome gradient. Derives up to two initials from the user's name.

**Files:**

- Create: `src/components/nav/NavAvatar.tsx`
- Test: `src/components/nav/__tests__/NavAvatar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/nav/__tests__/NavAvatar.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { NavAvatar, initialsFromName } from '../NavAvatar';

describe('initialsFromName', () => {
  it.each([
    ['Zach Rose', 'ZR'],
    ['zach', 'Z'],
    ['Mary Jane Watson', 'MW'],
    ['', '?'],
    [undefined, '?'],
  ])('derives initials from %s', (name, expected) => {
    expect(initialsFromName(name)).toBe(expected);
  });
});

describe('NavAvatar', () => {
  it('renders the initials', () => {
    const { getByText } = render(<NavAvatar name="Zach Rose" />);
    expect(getByText('ZR')).toBeInTheDocument();
  });

  it('is decorative (aria-hidden)', () => {
    const { container } = render(<NavAvatar name="Zach Rose" />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/nav/__tests__/NavAvatar.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/nav/NavAvatar.tsx
'use client';

import { Box } from '@mui/material';

/** Up to two initials from a display name; '?' when empty. */
export function initialsFromName(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface NavAvatarProps {
  name?: string | null;
  size?: number;
}

export function NavAvatar({ name, size = 28 }: NavAvatarProps) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #5b6d8c, #3d4a64)',
        color: 'text.primary',
        fontSize: size * 0.4,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {initialsFromName(name)}
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/nav/__tests__/NavAvatar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/nav/NavAvatar.tsx src/components/nav/__tests__/NavAvatar.test.tsx
git commit -m "feat(nav): NavAvatar initials avatar"
```

---

### Task 6: `AvatarMenu`

Shared menu rendered as a desktop dropdown (`variant="menu"`, anchored) or a mobile bottom sheet (`variant="sheet"`, `Drawer anchor="bottom"`). Items: **Pantry (sheet only)**, Manage food items, Manage users (admin only), Sign out. **No Settings link.**

**Files:**

- Create: `src/components/nav/AvatarMenu.tsx`
- Test: `src/components/nav/__tests__/AvatarMenu.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/nav/__tests__/AvatarMenu.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { pushMock, signOutMock } = vi.hoisted(() => ({ pushMock: vi.fn(), signOutMock: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock('next-auth/react', () => ({ signOut: signOutMock }));

import { AvatarMenu } from '../AvatarMenu';

beforeEach(() => {
  pushMock.mockReset();
  signOutMock.mockReset();
});

describe('AvatarMenu', () => {
  it('shows food items + sign out, and never a Settings link', () => {
    render(<AvatarMenu variant="menu" open onClose={vi.fn()} isAdmin={false} />);
    expect(screen.getByText('Manage food items')).toBeInTheDocument();
    expect(screen.getByText('Sign out')).toBeInTheDocument();
    expect(screen.queryByText(/settings/i)).not.toBeInTheDocument();
  });

  it('omits Pantry in the desktop menu variant but shows it in the sheet variant', () => {
    const { rerender } = render(
      <AvatarMenu variant="menu" open onClose={vi.fn()} isAdmin={false} />
    );
    expect(screen.queryByText('Pantry')).not.toBeInTheDocument();
    rerender(<AvatarMenu variant="sheet" open onClose={vi.fn()} isAdmin={false} />);
    expect(screen.getByText('Pantry')).toBeInTheDocument();
  });

  it('shows Manage users only for admins', () => {
    const { rerender } = render(
      <AvatarMenu variant="menu" open onClose={vi.fn()} isAdmin={false} />
    );
    expect(screen.queryByText('Manage users')).not.toBeInTheDocument();
    rerender(<AvatarMenu variant="menu" open onClose={vi.fn()} isAdmin />);
    expect(screen.getByText('Manage users')).toBeInTheDocument();
  });

  it('navigates on item click and signs out', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AvatarMenu variant="menu" open onClose={onClose} isAdmin />);
    await user.click(screen.getByText('Manage food items'));
    expect(pushMock).toHaveBeenCalledWith('/food-items');
    await user.click(screen.getByText('Sign out'));
    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: '/' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/nav/__tests__/AvatarMenu.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/nav/AvatarMenu.tsx
'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Menu,
  MenuItem,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import { Icon } from '@/components/ui/Icon';

export interface AvatarMenuProps {
  variant: 'menu' | 'sheet';
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  /** Required for the desktop dropdown variant. */
  anchorEl?: HTMLElement | null;
}

interface MenuAction {
  key: string;
  label: string;
  icon: string;
  onClick: () => void;
  /** Show only in the mobile sheet (Pantry is a top-nav section on desktop). */
  sheetOnly?: boolean;
  adminOnly?: boolean;
}

export function AvatarMenu({ variant, open, onClose, isAdmin, anchorEl }: AvatarMenuProps) {
  const router = useRouter();

  const go = useCallback(
    (href: string) => {
      router.push(href);
      onClose();
    },
    [router, onClose]
  );

  const handleSignOut = useCallback(() => {
    signOut({ callbackUrl: '/' });
    onClose();
  }, [onClose]);

  const actions: MenuAction[] = [
    {
      key: 'pantry',
      label: 'Pantry',
      icon: 'kitchen',
      onClick: () => go('/pantry'),
      sheetOnly: true,
    },
    {
      key: 'food-items',
      label: 'Manage food items',
      icon: 'format_list_bulleted',
      onClick: () => go('/food-items'),
    },
    {
      key: 'users',
      label: 'Manage users',
      icon: 'person',
      onClick: () => go('/user-management'),
      adminOnly: true,
    },
  ];

  const visible = actions.filter(
    (a) => (!a.sheetOnly || variant === 'sheet') && (!a.adminOnly || isAdmin)
  );

  if (variant === 'sheet') {
    return (
      <Drawer anchor="bottom" open={open} onClose={onClose}>
        <List sx={{ py: 1 }}>
          {visible.map((a) => (
            <ListItemButton key={a.key} onClick={a.onClick}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Icon name={a.icon} size={22} />
              </ListItemIcon>
              <ListItemText primary={a.label} />
            </ListItemButton>
          ))}
          <Divider sx={{ my: 1 }} />
          <ListItemButton onClick={handleSignOut}>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <Icon name="logout" size={22} />
            </ListItemIcon>
            <ListItemText primary="Sign out" />
          </ListItemButton>
        </List>
      </Drawer>
    );
  }

  return (
    <Menu
      anchorEl={anchorEl ?? null}
      open={open}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      keepMounted
    >
      {visible.map((a) => (
        <MenuItem key={a.key} onClick={a.onClick}>
          <ListItemIcon>
            <Icon name={a.icon} size={20} />
          </ListItemIcon>
          <ListItemText>{a.label}</ListItemText>
        </MenuItem>
      ))}
      <Divider />
      <MenuItem onClick={handleSignOut}>
        <ListItemIcon>
          <Icon name="logout" size={20} />
        </ListItemIcon>
        <ListItemText>Sign out</ListItemText>
      </MenuItem>
    </Menu>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/nav/__tests__/AvatarMenu.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/nav/AvatarMenu.tsx src/components/nav/__tests__/AvatarMenu.test.tsx
git commit -m "feat(nav): AvatarMenu (dropdown + bottom sheet, no Settings)"
```

---

### Task 7: `TopNav` (desktop)

Top bar: AppIcon + "Weekly Eats" wordmark (→ /meal-plans), 4 section buttons (active = section-color 2.5px bottom border + bold ink), avatar+name pill opening `AvatarMenu`. Hidden on mobile (`display: { xs: 'none', md: 'flex' }`).

**Files:**

- Create: `src/components/nav/TopNav.tsx`
- Test: `src/components/nav/__tests__/TopNav.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/nav/__tests__/TopNav.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { pushMock, usePathnameMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  usePathnameMock: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: usePathnameMock,
}));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Zach Rose', isAdmin: true } } }),
  signOut: vi.fn(),
}));

import { TopNav } from '../TopNav';

beforeEach(() => {
  pushMock.mockReset();
  usePathnameMock.mockReturnValue('/recipes');
});

describe('TopNav', () => {
  it('renders the wordmark and all four sections', () => {
    render(<TopNav />);
    expect(screen.getByText('Weekly Eats')).toBeInTheDocument();
    ['Plans', 'Shop', 'Recipes', 'Pantry'].forEach((l) =>
      expect(screen.getByRole('button', { name: l })).toBeInTheDocument()
    );
  });

  it('marks the active section with aria-current', () => {
    render(<TopNav />);
    expect(screen.getByRole('button', { name: 'Recipes' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Plans' })).not.toHaveAttribute('aria-current');
  });

  it('navigates when a section is clicked', async () => {
    const user = userEvent.setup();
    render(<TopNav />);
    await user.click(screen.getByRole('button', { name: 'Plans' }));
    expect(pushMock).toHaveBeenCalledWith('/meal-plans');
  });

  it('opens the avatar menu', async () => {
    const user = userEvent.setup();
    render(<TopNav />);
    await user.click(screen.getByRole('button', { name: /account menu/i }));
    expect(screen.getByText('Manage food items')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/nav/__tests__/TopNav.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/nav/TopNav.tsx
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Box, Button } from '@mui/material';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';
import { NAV_SECTIONS } from '@/lib/nav-sections';
import { useActiveSection } from '@/lib/hooks/use-active-section';
import { AppIcon } from './AppIcon';
import { NavAvatar } from './NavAvatar';
import { AvatarMenu } from './AvatarMenu';

export function TopNav() {
  const router = useRouter();
  const { data: session } = useSession();
  const active = useActiveSection();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const user = session?.user;
  const name = user?.name ?? '';

  const openMenu = useCallback(
    (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget),
    []
  );
  const closeMenu = useCallback(() => setAnchorEl(null), []);

  return (
    <Box
      component="header"
      sx={{
        display: { xs: 'none', md: 'flex' },
        alignItems: 'center',
        px: 3.5,
        py: 1.5,
        bgcolor: 'background.default',
        borderBottom: `1px solid ${tokens.border.subtle}`,
      }}
    >
      <Box
        onClick={() => router.push('/meal-plans')}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <AppIcon size={30} />
        <Box
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 700,
            color: 'text.primary',
          }}
        >
          Weekly Eats
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 0.5, ml: 3.5, flex: 1 }}>
        {NAV_SECTIONS.map((s) => {
          const on = s.key === active;
          return (
            <Button
              key={s.key}
              onClick={() => router.push(s.href)}
              aria-current={on ? 'page' : undefined}
              disableRipple
              sx={{
                height: 50,
                px: 1.75,
                minWidth: 0,
                gap: 1,
                borderRadius: 0,
                color: on ? 'text.primary' : 'text.secondary',
                fontSize: 14.5,
                fontWeight: on ? 600 : 500,
                borderBottom: `2.5px solid ${on ? s.color : 'transparent'}`,
                '&:hover': { bgcolor: 'transparent', color: 'text.primary' },
              }}
            >
              <Icon name={s.icon} size={18} color={s.color} />
              {s.label}
            </Button>
          );
        })}
      </Box>

      <Button
        onClick={openMenu}
        aria-label="Account menu"
        aria-haspopup="true"
        disableRipple
        sx={{
          height: 40,
          pl: 0.75,
          pr: 1.5,
          gap: 1.25,
          borderRadius: 999,
          border: `1px solid ${tokens.border.subtle}`,
          color: 'text.primary',
          fontSize: 14,
          fontWeight: 500,
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <NavAvatar name={name} size={28} />
        {name}
      </Button>

      <AvatarMenu
        variant="menu"
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={closeMenu}
        isAdmin={Boolean(user?.isAdmin)}
      />
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/nav/__tests__/TopNav.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/nav/TopNav.tsx src/components/nav/__tests__/TopNav.test.tsx
git commit -m "feat(nav): TopNav desktop bar"
```

---

### Task 8: `BottomNav` (mobile)

Fixed bottom bar, 4 slots: **Plans / Shop / Recipes / Avatar** (no Pantry). Active section slot uses section color. Avatar slot opens the `AvatarMenu` bottom sheet. Visible only on mobile (`display: { xs: 'flex', md: 'none' }`).

**Files:**

- Create: `src/components/nav/BottomNav.tsx`
- Test: `src/components/nav/__tests__/BottomNav.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/nav/__tests__/BottomNav.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { pushMock, usePathnameMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  usePathnameMock: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: usePathnameMock,
}));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Zach Rose', isAdmin: false } } }),
  signOut: vi.fn(),
}));

import { BottomNav } from '../BottomNav';

beforeEach(() => {
  pushMock.mockReset();
  usePathnameMock.mockReturnValue('/shopping-lists');
});

describe('BottomNav', () => {
  it('renders Plans/Shop/Recipes + Account, but not a Pantry slot', () => {
    render(<BottomNav />);
    ['Plans', 'Shop', 'Recipes'].forEach((l) =>
      expect(screen.getByRole('button', { name: l })).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: /account/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pantry' })).not.toBeInTheDocument();
  });

  it('marks the active slot with aria-current', () => {
    render(<BottomNav />);
    expect(screen.getByRole('button', { name: 'Shop' })).toHaveAttribute('aria-current', 'page');
  });

  it('navigates on slot click', async () => {
    const user = userEvent.setup();
    render(<BottomNav />);
    await user.click(screen.getByRole('button', { name: 'Recipes' }));
    expect(pushMock).toHaveBeenCalledWith('/recipes');
  });

  it('opens the bottom sheet with Pantry from the avatar slot', async () => {
    const user = userEvent.setup();
    render(<BottomNav />);
    await user.click(screen.getByRole('button', { name: /account/i }));
    expect(screen.getByText('Pantry')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/nav/__tests__/BottomNav.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/nav/BottomNav.tsx
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Box, ButtonBase } from '@mui/material';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';
import { NAV_SECTIONS } from '@/lib/nav-sections';
import { useActiveSection } from '@/lib/hooks/use-active-section';
import { NavAvatar } from './NavAvatar';
import { AvatarMenu } from './AvatarMenu';

// Plans, Shop, Recipes — Pantry is NOT a mobile slot (lives in the avatar sheet).
const SLOTS = NAV_SECTIONS.filter((s) => s.key !== 'pantry');

const slotSx = (color: string) => ({
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  gap: 0.5,
  py: 0.5,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
  color,
});

export function BottomNav() {
  const router = useRouter();
  const { data: session } = useSession();
  const active = useActiveSection();
  const [sheetOpen, setSheetOpen] = useState(false);

  const user = session?.user;
  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  return (
    <>
      <Box
        component="nav"
        sx={{
          display: { xs: 'grid', md: 'none' },
          gridTemplateColumns: 'repeat(4, 1fr)',
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1100,
          pt: 1,
          pb: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
          bgcolor: 'background.paper',
          borderTop: `1px solid ${tokens.border.subtle}`,
        }}
      >
        {SLOTS.map((s) => {
          const on = s.key === active;
          return (
            <ButtonBase
              key={s.key}
              onClick={() => router.push(s.href)}
              aria-label={s.label}
              aria-current={on ? 'page' : undefined}
              sx={slotSx(on ? s.color : tokens.text.secondary)}
            >
              <Icon name={s.icon} size={22} color={on ? s.color : tokens.text.secondary} />
              {s.label}
            </ButtonBase>
          );
        })}
        <ButtonBase
          onClick={openSheet}
          aria-label="Account"
          aria-haspopup="true"
          sx={slotSx(tokens.text.secondary)}
        >
          <NavAvatar name={user?.name} size={22} />
          Account
        </ButtonBase>
      </Box>

      <AvatarMenu
        variant="sheet"
        open={sheetOpen}
        onClose={closeSheet}
        isAdmin={Boolean(user?.isAdmin)}
      />
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/nav/__tests__/BottomNav.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/nav/BottomNav.tsx src/components/nav/__tests__/BottomNav.test.tsx
git commit -m "feat(nav): BottomNav mobile bar (4 slots, Pantry in sheet)"
```

---

### Task 9: Rewire `AuthenticatedLayout` + delete old chrome

Render the new chrome, wire `SectionThemeProvider` centrally around `{children}`, and own the unapproved-user redirect (formerly in `Header`). Delete `Header.tsx` and the old `src/components/BottomNav.tsx`. Update the load-bearing test.

**Files:**

- Modify: `src/components/AuthenticatedLayout.tsx`
- Delete: `src/components/Header.tsx`, `src/components/BottomNav.tsx`
- Modify: `src/components/__tests__/AuthenticatedLayout.test.tsx`

- [ ] **Step 1: Update the load-bearing test (write first, expect fail until impl)**

```tsx
// src/components/__tests__/AuthenticatedLayout.test.tsx
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const { useApprovalStatusMock, useSessionMock, pushMock, usePathnameMock } = vi.hoisted(() => ({
  useApprovalStatusMock: vi.fn(() => ({ isRedirecting: false })),
  useSessionMock: vi.fn(() => ({
    data: { user: { name: 'Zach Rose', isApproved: true, isAdmin: false } },
  })),
  pushMock: vi.fn(),
  usePathnameMock: vi.fn(() => '/meal-plans'),
}));
vi.mock('../../lib/use-approval-status', () => ({ useApprovalStatus: useApprovalStatusMock }));
vi.mock('next-auth/react', () => ({ useSession: useSessionMock }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: usePathnameMock,
}));
// Mock the chrome + section provider so the layout's own logic is what we exercise.
vi.mock('../nav/TopNav', () => ({ TopNav: () => <div data-testid="topnav" /> }));
vi.mock('../nav/BottomNav', () => ({ BottomNav: () => <div data-testid="bottomnav" /> }));
vi.mock('../nav/SectionThemeProvider', () => ({
  SectionThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import AuthenticatedLayout from '../AuthenticatedLayout';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
beforeEach(() => {
  useApprovalStatusMock.mockReturnValue({ isRedirecting: false });
  useSessionMock.mockReturnValue({
    data: { user: { name: 'Zach Rose', isApproved: true, isAdmin: false } },
  });
  usePathnameMock.mockReturnValue('/meal-plans');
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

  it('renders children + chrome for an approved user', () => {
    const { getByText, getByTestId } = render(
      <AuthenticatedLayout>
        <span>content</span>
      </AuthenticatedLayout>
    );
    expect(getByText('content')).toBeInTheDocument();
    expect(getByTestId('topnav')).toBeInTheDocument();
    expect(getByTestId('bottomnav')).toBeInTheDocument();
  });

  it('redirects an unapproved user to /pending-approval and hides the chrome', () => {
    useSessionMock.mockReturnValue({
      data: { user: { name: 'X', isApproved: false, isAdmin: false } },
    });
    usePathnameMock.mockReturnValue('/meal-plans');
    const { queryByTestId } = render(
      <AuthenticatedLayout>
        <span>content</span>
      </AuthenticatedLayout>
    );
    expect(pushMock).toHaveBeenCalledWith('/pending-approval');
    expect(queryByTestId('topnav')).not.toBeInTheDocument();
  });

  it('does not redirect an unapproved user already on /pending-approval', () => {
    useSessionMock.mockReturnValue({
      data: { user: { name: 'X', isApproved: false, isAdmin: false } },
    });
    usePathnameMock.mockReturnValue('/pending-approval');
    render(
      <AuthenticatedLayout>
        <span>content</span>
      </AuthenticatedLayout>
    );
    expect(pushMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/__tests__/AuthenticatedLayout.test.tsx`
Expected: FAIL — old impl imports `./Header`/`./BottomNav` (default) and has no redirect logic.

- [ ] **Step 3: Rewrite `AuthenticatedLayout`**

```tsx
// src/components/AuthenticatedLayout.tsx
'use client';

import { useEffect } from 'react';
import { Box, CircularProgress, Container } from '@mui/material';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { TopNav } from './nav/TopNav';
import { BottomNav } from './nav/BottomNav';
import { SectionThemeProvider } from './nav/SectionThemeProvider';
import { useApprovalStatus } from '../lib/use-approval-status';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { isRedirecting } = useApprovalStatus();
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const user = session?.user;
  const isUnapproved = !!user && !user.isApproved && !user.isAdmin;

  // Route unapproved users to the pending-approval page (previously owned by Header).
  useEffect(() => {
    if (isUnapproved && pathname !== '/pending-approval') {
      router.push('/pending-approval');
    }
  }, [isUnapproved, pathname, router]);

  // Show nav only for an authenticated, approved (or admin) user.
  const showNav = !!user && !isUnapproved;

  if (isRedirecting) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        {showNav && <TopNav />}
        <Container maxWidth="md">
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4, pt: { xs: 8, md: 4 } }}>
            <CircularProgress />
          </Box>
        </Container>
        {showNav && <BottomNav />}
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {showNav && <TopNav />}
      <Box component="main" sx={{ pt: { xs: 2, md: 3 }, pb: { xs: 10, md: 3 } }}>
        <SectionThemeProvider>{children}</SectionThemeProvider>
      </Box>
      {showNav && <BottomNav />}
    </Box>
  );
}
```

- [ ] **Step 4: Delete the old chrome**

```bash
git rm src/components/Header.tsx src/components/BottomNav.tsx
```

- [ ] **Step 5: Run the layout test + a broad nav-area test pass**

Run: `MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npx vitest run src/components/__tests__/AuthenticatedLayout.test.tsx src/components/nav src/lib/__tests__/nav-sections.test.ts src/lib/hooks/__tests__/use-active-section.test.tsx`
Expected: PASS (all nav + layout tests).

Also confirm nothing else imported the deleted files:
Run: `grep -rEn "components/Header|components/BottomNav|from './Header'|from './BottomNav'" src` → expect **no matches** (the old `BottomNav` default import is gone; new nav uses `./nav/BottomNav`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(nav): rewire AuthenticatedLayout to new chrome; central section theming + approval redirect; remove old Header/BottomNav"
```

---

## Self-Review (completed against spec §3 / §2 / §1)

- **§3 components** — `TopNav` (T7), `BottomNav` (T8), `AppIcon` (T4), `NavAvatar` (T5), `AvatarMenu` (T6): ✅. Avatar menu has **no Settings link**, Pantry is sheet-only, Manage users is admin-gated (T6). ✅
- **§3 active-section detection** — single `getSectionForPath` (T1) + `useActiveSection` (T2), consumed by `TopNav`/`BottomNav`/`SectionThemeProvider`: ✅
- **§3 named exports / remove old chrome / inline per-page headers** — named exports ✅; `Header`+`BottomNav` deleted (T9) ✅; per-page header inlining is per-surface (chunks 3–8), not this chunk ✅.
- **§2 per-section accent / nesting constraint** — `SectionThemeProvider` introduced (T3) and wired centrally in `AuthenticatedLayout` (T9), avoiding the client-component-as-layout constraint. Deviation documented above + for the ledger. ✅
- **§1 client gate mount load-bearing** — `useApprovalStatus` still mounted in `AuthenticatedLayout`; the unapproved redirect is preserved + tested (T9). ✅
- **Type consistency** — `SectionKey` from `nav-sections.ts` flows through `useActiveSection`, `SectionThemeProvider`, `tokens.section[section]`; `NAV_SECTIONS` shape (`key/label/href/icon/color`) used identically in `TopNav`/`BottomNav`/`getSectionForPath`. ✅
- **Placeholder scan** — every code step is complete; no TODO/TBD. ✅
- **Carryover** — `CachedAvatar` orphaned (Chunk 11 cleanup); icon webfont ligatures (`calendar_month`, `shopping_cart`, `restaurant`, `kitchen`, `format_list_bulleted`, `person`, `logout`) consumed via existing `ui/Icon`.

## Per-chunk loop after implementation (spec §5)

1. `npm run check` green locally.
2. `review-code` auto-fix loop, base `redesign-chunk-01` (`/review-code --base redesign-chunk-01`).
3. `npm run check` again after fixes.
4. `manual-testing` slot `chunk-02-nav` — seed local dev DB, post checklist comment to PR #89.
5. Push → CI + beta deploy.
6. Execute the chunk-qualification plan on localhost + local dev DB (the gate).
7. Fold in fixes; re-review if substantial.
8. Tag `redesign-chunk-02`.
9. Update the ledger (status done; tag; plan-doc; PR comment; deviations: central SectionThemeProvider, NavAvatar initials, CachedAvatar orphan).
10. Merge `main` → branch if main moved (and back-merge #83 once it lands).
11. Compaction handoff.
