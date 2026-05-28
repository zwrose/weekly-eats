// src/lib/hooks/use-active-section.ts
'use client';

import { usePathname } from 'next/navigation';
import { getSectionForPath, type SectionKey } from '../nav-sections';

/** The active top-level section for the current route, or null for system pages. */
export function useActiveSection(): SectionKey | null {
  return getSectionForPath(usePathname());
}
