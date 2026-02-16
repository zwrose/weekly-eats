# Decisions Log

## ADR-001: Incremental Refactor Over Full Server Component Migration

**Date:** 2026-02-15
**Status:** Accepted

**Context:** The audit found that all pages are client components with no server-side rendering. A full migration to server components would be the ideal end state but would require restructuring every page and hook.

**Decision:** Take a pragmatic, incremental approach — focus on code splitting, dynamic imports, and data fetching optimizations within the current client-component architecture. Add App Router conventions (loading.tsx, error.tsx, metadata) that work alongside client components. Defer full Server Component migration to a future track.

**Rationale:** The highest-impact wins (eliminating waterfalls, code splitting, memoization) don't require a server component migration. The effort/risk of a full migration outweighs the benefit for this track.

## ADR-002: No New State Management Library

**Date:** 2026-02-15
**Status:** Accepted

**Context:** The audit identified that all state management is via useState/useCallback/useEffect hooks with manual fetch. Libraries like SWR, TanStack Query, or Zustand could improve data deduplication and caching.

**Decision:** Do not introduce SWR or TanStack Query in this track. Focus on fixing the existing patterns (batch endpoints, optimistic updates, useTransition). Recommend SWR adoption as a future track if manual patterns prove insufficient.

**Rationale:** Adding a new dependency changes the project's data fetching paradigm significantly. The current manual approach works and can be improved without new libraries. Keeps this track focused on architecture fixes rather than paradigm shifts.
