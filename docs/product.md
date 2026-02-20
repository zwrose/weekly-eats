# Product Vision and Guidelines

## Product Vision

Weekly Eats is an all-in-one kitchen hub that centralizes recipes, meal plans, pantry tracking, and shopping lists for households and families.

**Target users:** Individuals and families who plan meals on a weekly basis -- from casual cooks to organized meal preppers.

**Problem:** Busy households struggle to coordinate weekly meals, keep track of pantry inventory, manage shared recipes, and create efficient shopping lists. Existing tools are fragmented (one app for recipes, another for shopping lists, spreadsheets for meal planning), leading to wasted food, duplicated effort, and mealtime stress. Weekly Eats brings all of these into a single, collaborative application.

**Success looks like:**

- A household can plan a full week of meals in minutes
- Shopping lists auto-generate from meal plans with smart unit deconfliction
- Multiple household members collaborate in real-time on shared lists
- The recipe library grows organically with personal and shared recipes

## Core Features

### Meal Planning

Weekly meal plans built from reusable templates. Users configure their week start day and which meal types to track (breakfast, lunch, dinner). Plans support weekly staples -- recurring items that carry over each week. Meal plans can be shared with other household members via email invitation.

### Recipes

Create and edit recipes with grouped ingredients, step-by-step instructions, tags, and personal ratings. Recipes can be shared between users, with the option to share tags and/or ratings independently. Both personal and global (admin-curated) recipes are supported. Recipes are viewable directly from meal plans, and recipe ingredients are clickable for quick reference.

### Shopping Lists

Per-store shopping lists that can be populated from meal plans with automatic unit deconfliction (e.g., combining "2 cups" and "1 cup" of the same ingredient). Items support drag-and-drop reorder to match a store's layout. Real-time sync via Ably lets multiple household members shop from the same list simultaneously. The "Finish Shop" flow records purchase history for future reference.

### Food Items

A centralized food item catalog shared across recipes, pantry, and shopping lists. Admins manage global items; users can add personal items. Each item has a unit and singular/plural name forms.

### Pantry

Track items typically kept on hand so they can be excluded from shopping lists. This is a quick-reference checklist, not a precise inventory system.

### Settings

- Theme preference: light, dark, or system default
- Default meal plan owner selection
- Recipe and meal plan sharing preferences

### User Management

Admin approval workflow for new users. Two roles: admin and standard user. Admins manage global food items, approve new users, and access user management.

### Sharing

Email-based invitation system for meal plans, recipes, and store-based shopping lists. Invitations grant scoped access -- a shared meal plan does not automatically share the underlying recipes.

## UX Guidelines

### Design System

All UI is built with MUI (Material UI) components. Styling uses the `sx` prop exclusively -- no CSS files or CSS modules. The theme supports light and dark modes with a custom Figtree/Roboto font stack, rounded buttons (24px radius), and soft card shadows. See `src/lib/theme.ts` for the full theme definition.

### Responsive Design

The app serves desktop and mobile equally. Key patterns:

- **App shell:** `Header` (top bar) + `BottomNav` (mobile only, hidden on md+) wrapping page content via `AuthenticatedLayout`
- **Full-screen dialogs on mobile:** Dialogs use `responsiveDialogStyle` from `src/lib/theme.ts` to go full-screen on xs breakpoints and standard modal on sm+
- **Bottom padding:** Main content includes extra bottom padding on mobile to clear the fixed bottom navigation bar

### Loading and Error States

- Every route has a `loading.tsx` file providing a skeleton loading state
- Every route has an `error.tsx` file providing an error boundary
- Session loading shows a centered `CircularProgress` spinner

### Performance

- Heavy dialog components are dynamically imported with `next/dynamic` using `{ ssr: false }` to reduce initial bundle size
- Lists use server-side pagination for large datasets
- Components are memoized with `React.memo` where appropriate

### Tone

Functional and friendly. Labels are concise and action-oriented. Icons carry meaning where possible. Emoji are used as visual shorthand for recipes and food item categories. Error messages are consistent, drawn from centralized constants.

### Accessibility

- Keyboard navigable throughout, using MUI's built-in focus management
- ARIA labels on all interactive elements (icon buttons, navigation actions, autocomplete inputs)
- Semantic HTML via MUI components (proper button, input, and label elements)

## Development Principles

### Test-Driven Development

Write failing tests first, then implement the minimum code to make them pass, then refactor. This red-green-refactor cycle applies to all new features and bug fixes.

### Quality Standards

- **Test coverage target:** >80% for all new code
- **Zero lint warnings:** Enforced in CI via GitHub Actions on pushes and PRs to `main` and `develop`
- **Full validation before pushing:** Run `npm run check` (lint + test + build) before every push
- **TypeScript strict mode:** No `any` casts or type workarounds without documented justification

### Workflow

- Frequent, small commits with conventional commit messages (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`)
- Worktree isolation for parallel development -- each feature branch gets its own port, database, and `node_modules`
- CI runs lint and test with coverage on every push and pull request
