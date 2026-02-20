# Documentation Reorganization Design

**Date:** 2026-02-19
**Status:** Approved

## Problem

The repository accumulated documentation across three locations with different purposes:
- `conductor/` — 42 files from the Conductor plugin (product vision, tech stack, workflow, code style, architecture, API patterns, testing patterns, code conventions, and 6 feature tracks)
- `docs/` — 14 files of varying quality and currency (some current, some stale, some one-off)
- `CLAUDE.md` — concise quick-reference for AI agents and developers

With the switch from Conductor to Superpowers, the conductor-specific structure no longer serves its original purpose. Meanwhile, the docs/ directory contains a mix of valuable reference material and stale artifacts. The documentation needs consolidation into a clean, maintainable structure.

## Decision

**CLAUDE.md as hub + docs/ for depth.** Five well-organized docs files cover all substantive content. CLAUDE.md stays concise and links to docs/ for deeper reference.

## Final Structure

```
CLAUDE.md                    # Hub: quick-reference + links to docs/
docs/
  architecture.md            # System design, features, state, auth, real-time, DB
  api-patterns.md            # REST conventions, auth, validation, errors, responses
  testing.md                 # Vitest setup, mocking patterns, component/API/hook testing
  setup.md                   # Environment, DB, dev server, worktrees, CI, migration
  product.md                 # Product vision, features, UX guidelines, dev principles
```

## What Gets Deleted

### Deleted outright (no content worth extracting):
- `README.md` — Next.js boilerplate
- `docs/TODO.md` — 2 stale bullet points
- `docs/manual-testing-recipe-search-fix.md` — one-off bug test
- `docs/BUILD_ERRORS.md` — already in CLAUDE.md Gotchas
- `docs/food-item-input-architecture-plan.md` — stale 140hr refactor plan, never executed
- `docs/food-item-input-migration-progress.md` — stale WIP tracker
- `docs/user-management-api-tests.md` — specific test documentation, patterns extracted to testing.md

### Deleted after content extraction:
- `docs/state-management-refactor.md` — custom hooks list and optimized component patterns extracted to architecture.md
- `docs/authentication-security.md` — auth flow absorbed into architecture.md
- `docs/shopping-sync.md` — real-time architecture absorbed into architecture.md
- `docs/modal-persistence.md` — URL dialog state absorbed into architecture.md
- `docs/SETUP.md` — replaced by new setup.md
- `docs/MONGODB_MIGRATION.md` — absorbed into setup.md
- `conductor/` — entire directory (42 files), all valuable content extracted into the new docs

## Content Mapping

### CLAUDE.md (updated)
- Add links to docs/ files in relevant sections
- Absorb code style rules from conductor: file naming (PascalCase components, kebab-case utils), TypeScript preferences (interfaces over types, unknown over any, no assertions), named exports only

### docs/architecture.md
Sources: conductor/docs/architecture.md, conductor/tech-stack.md, docs/authentication-security.md, docs/shopping-sync.md, docs/modal-persistence.md, docs/state-management-refactor.md, conductor track decisions, codebase exploration findings

Sections:
- Tech stack with rationale
- Feature routes (all 8) with descriptions
- State management (ThemeContext, custom hooks, URL state)
- Authentication flow end-to-end
- Real-time architecture (Ably channels, events, presence, reconnect)
- Database collections (all 12) with indexes and sharing model
- Key subsystems (unit deconfliction, pagination, dialog persistence)
- Custom hooks reference (15+ hooks)

### docs/api-patterns.md
Sources: conductor/docs/api-patterns.md, API route codebase exploration

Sections:
- Route structure and URL patterns
- Authentication pattern (getServerSession + authOptions)
- Error handling (try/catch, logError, error constants)
- Validation patterns (ObjectId, body fields, email, dates)
- Response formats (single resource, paginated list, action confirmation)
- Database access pattern (singleton)
- Pagination utilities

### docs/testing.md
Sources: docs/testing.md, conductor/docs/testing-patterns.md, testing codebase exploration

Sections:
- Configuration (Vitest, jsdom, fork pool, timeouts, coverage)
- Setup files (react-act.setup.ts, vitest.setup.ts — order matters)
- Mocking patterns (MongoDB, NextAuth, MSW, @/lib/errors)
- API route testing (dynamic imports, makeReq, async params, DB call verification)
- Component testing (userEvent, act(), MUI interactions, debounce)
- Hook testing (TestComponent harness)
- Running tests (commands)

### docs/setup.md
Sources: docs/SETUP.md, docs/MONGODB_MIGRATION.md, config codebase exploration

Sections:
- Prerequisites (Node 20, MongoDB 8.0, Google OAuth, Ably)
- Environment variables (6 required vars)
- Ubuntu setup (scripts/setup-ubuntu.sh)
- Database setup (indexes, postinstall, authoritative source)
- Dev server (dev vs dev:fast, Turbopack, .next cache)
- Worktree workflow (create/list/remove, isolation)
- Database migration (mongodump/mongorestore)
- CI (GitHub Actions, lint + test + coverage, Codecov)

### docs/product.md
Sources: conductor/product.md, conductor/product-guidelines.md, conductor/workflow.md

Sections:
- Product vision and target users
- Core features (8 feature areas)
- UX guidelines (MUI patterns, responsive design, tone, accessibility)
- Development principles (TDD, coverage target, quality gates, worktree isolation)
