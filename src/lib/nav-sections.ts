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
