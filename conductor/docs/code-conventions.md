# Code Conventions

> Detected from codebase analysis (Confidence: HIGH)

## File Naming

| Location | Convention | Examples |
|----------|-----------|----------|
| `src/components/` | PascalCase | `Header.tsx`, `BottomNav.tsx`, `SessionWrapper.tsx` |
| `src/lib/` | kebab-case | `date-utils.ts`, `food-items-utils.ts`, `shopping-list-utils.ts` |
| `src/lib/hooks/` | kebab-case with `use-` prefix | `use-recipes.ts`, `use-dialog.ts`, `use-food-items.ts` |
| `src/types/` | kebab-case | `recipe.ts`, `meal-plan.ts`, `shopping-list.ts` |
| `src/app/api/` | kebab-case routes | `food-items/`, `shopping-lists/`, `meal-plans/` |
| Tests | `*.test.ts(x)` in `__tests__/` dirs | `SearchBar.test.tsx`, `route.test.ts` |

## Component Naming

- React components use **PascalCase**: `Header`, `SessionWrapper`, `EmojiPicker`
- All components use **default exports**: `export default function Header() {}`
- Props interfaces: **PascalCase + "Props"** suffix: `SessionWrapperProps`, `EmojiPickerProps`

## Function & Hook Naming

- Custom hooks: **camelCase with "use" prefix**: `useRecipes`, `useFoodItems`, `useDialog`
- Utility functions: **camelCase**: `formatDateForAPI`, `calculateEndDate`, `isValidDayOfWeek`
- Event handlers: **"handle" prefix**: `handleProfileMenu`, `handleClose`, `handleSignOut`
- Data fetching: **"fetch/load" prefix**: `fetchUserRecipes`, `loadGlobalRecipes`

## Variables & Constants

- Constants: **UPPER_SNAKE_CASE**: `AUTH_ERRORS`, `FOOD_UNITS`, `VALID_DAYS_OF_WEEK`
- State variables: **camelCase**: `userRecipes`, `globalRecipes`, `loading`, `anchorEl`
- Interfaces/Types: **PascalCase**: `PantryItem`, `Recipe`, `CreateRecipeRequest`

## Export Patterns

| Type | Pattern | Example |
|------|---------|---------|
| Components | Default export | `export default function Header()` |
| Utilities | Named exports | `export const FOOD_UNITS`, `export const isValidDayOfWeek` |
| Hooks | Barrel re-exports in `index.ts` | `export { useFoodItems } from './use-food-items'` |
| Types | Named exports | `export interface Recipe`, `export type DayOfWeek` |

## Directives

- All interactive components start with `"use client"` directive
- Server components (API routes) do not use the directive
