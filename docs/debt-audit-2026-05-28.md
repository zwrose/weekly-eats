# Technical Debt Audit — 2026-05-28

> Living backlog produced by `/audit-debt` on the pre-redesign codebase (branch `claude-design-redesign`, head before Chunk 0 hardening). Sorted by severity × inverse-effort within each category. Pull from this opportunistically; items tagged **[Chunk 0]** are in-scope for the data-layer hardening pass.

**Totals:** 1 Critical · 27 Important · 27 Minor · 3 Nit (58 total)

## Disposition

- **Fixed in Chunk 0c** (this branch): the Critical Ably token leak; `ObjectId.isValid` guards (meal-plans/[id], food-items/[id], admin approve/toggle-admin); mass-assignment allowlists (recipes/[id] PUT, user/settings POST); and the data-layer test gaps (meal-plan-utils golden-master, shopping-list-position-utils, recipe-user-data-utils, the sharing/shopping-list fetch-wrapper MSW coverage, and the 13 sharing/store route tests).
- **Filed as GitHub issues** (backlog, scheduled separately): #76 (npm advisories), #77 (star-rating a11y), #78–#79 (meal-plan route refactors), #80 (sharing-utils duplication), #81 (emoji-picker keyboard), #82 (shopping-lists monolith → Chunk 5), #83 (server-side approval → Chunk 1), #84–#86 (grouped Minor/Nit: architecture, code, a11y).

## Summary

58 findings across 8 dimensions. 1 Critical (unscoped Ably realtime token leaking cross-user shopping data), 27 Important (security input-guards + mass-assignment, data-layer test gaps, two API-route refactors, the 2885-line shopping-lists monolith, and missing server-side approval enforcement), 27 Minor, 3 Nit. Top Chunk-0 actionables: the Ably token fix, the cheap ObjectId.isValid guards, and data-layer test hardening (meal-plan-utils golden-master, shopping-list-position-utils, sharing-utils MSW coverage).

## Security (7)

### Critical · Medium — Ably token endpoint has no auth check and issues unscoped wildcard-capability tokens, leaking other users' shopping data over realtime

`src/app/api/ably/token/route.ts:22`

The GET handler creates an Ably token with `client.auth.createTokenRequest({ clientId: 'weekly-eats' }, ...)` (line 30) — no `capability` is specified, so Ably grants the token full subscribe/publish access to ALL channels, and the handler performs NO session check. Shopping list updates are published per-store on channel `shopping-store:${storeId}` (src/lib/realtime/ably-server.ts:31) carrying item names, quantities and the editor's email. Because the token is unscoped, any caller who can reach this endpoint can subscribe to `shopping-store:<anyStoreId>` and receive another user's shopping data with no store-membership check — bypassing the careful `$or: [{ userId }, { 'invitations.userId': ..., status: 'accepted' }]` gate enforced on every shopping-list REST route (e.g. src/app/api/shopping-lists/[storeId]/route.ts:32-38). The handler also relies entirely on middleware (src/middleware.ts:30) for auth, which only redirects when `!token` and never scopes by store.

**Fix:** Add a session check at the top of the handler (`const session = await getServerSession(authOptions); if (!session?.user?.id) return 401`) mirroring every other route. Then scope the token capability to only the channels the user may access: look up the user's owned + accepted-invitation stores and build `capability: { 'shopping-store:<id>': ['subscribe','publish'] }` for each, passing it into `createTokenRequest`. Do not issue a wildcard-capability token.

### Important · Quick — meal-plans/[id] GET/PUT/DELETE call new ObjectId(id) with no ObjectId.isValid guard

`src/app/api/meal-plans/[id]/route.ts:31`

The route id comes from the URL param but is passed straight to `new ObjectId(id)` with no `ObjectId.isValid(id)` guard in GET (line 31), PUT (lines 180, 230, 238) and DELETE (lines 282, 311). A malformed id (e.g. `/api/meal-plans/abc`) throws inside the constructor and surfaces as a generic 500 instead of a clean 400. Every other [id] route in the codebase guards this (recipes/[id]/route.ts:21, food-items/[id]/route.ts:21 GET, stores/[id]/route.ts:20, pantry/[id]/route.ts:22). DoS/robustness, not a data leak.

**Fix:** Add `if (!ObjectId.isValid(id)) return NextResponse.json({ error: MEAL_PLAN_ERRORS.MEAL_PLAN_NOT_FOUND }, { status: 400 });` immediately after `const { id } = await params;` in each handler, matching the pattern in recipes/[id]/route.ts:21.

### Important · Quick — food-items/[id] PUT and DELETE call new ObjectId(id) with no ObjectId.isValid guard

`src/app/api/food-items/[id]/route.ts:67`

The GET handler guards the id with `ObjectId.isValid` (line 21), but PUT (line 67) and DELETE (line 162) call `new ObjectId(id)` directly on the URL param with no guard. A malformed id throws and surfaces as a 500 rather than a 400. Robustness/DoS, not a leak — the ownership checks (createdBy + isAdmin) downstream are correct.

**Fix:** Add `if (!ObjectId.isValid(id)) return NextResponse.json({ error: API_ERRORS.BAD_REQUEST }, { status: 400 });` after `const { id } = await params;` in both PUT and DELETE, matching the GET handler at line 21.

### Important · Quick — admin approve / toggle-admin call ObjectId.createFromHexString on body userId without ObjectId.isValid guard

`src/app/api/admin/users/approve/route.ts:35`

Both admin routes read `userId` from the request body and pass it directly to `ObjectId.createFromHexString(userId)` without an `ObjectId.isValid` check: approve/route.ts:35 and toggle-admin/route.ts:34 & 45. They validate `!userId` is truthy but not that it is a valid hex ObjectId, so a malformed value throws and surfaces as a 500 instead of a 400. The admin gate itself is correct (both re-query `users` for `isAdmin` and 403 if not). Robustness/DoS only.

**Fix:** After parsing the body, add `if (!userId || typeof userId !== 'string' || !ObjectId.isValid(userId)) return NextResponse.json({ error: USER_ERRORS.INVALID_USER_ID }, { status: 400 });` before constructing the ObjectId. `USER_ERRORS.INVALID_USER_ID` already exists in src/lib/errors.ts:56.

### Important · Medium — recipes/[id] PUT mass-assigns request body, letting a user set isGlobal/createdBy on their own recipe

`src/app/api/recipes/[id]/route.ts:171`

The PUT handler builds `const updateData = { ...body, updatedAt: new Date() }` (lines 171-174) and writes it with `$set: updateData`. The ownership filter `{ _id, createdBy: session.user.id }` (line 178) prevents editing someone else's recipe, but the spread still lets the owner inject fields the API never intended to be client-settable: e.g. `isGlobal: true` (publishing a private recipe to every user, normally an admin-gated transition — compare the food-items route which explicitly gates `isGlobal` changes at src/app/api/food-items/[id]/route.ts:88-105), or overwriting `createdBy`, `createdAt`. The canonical dual-filter is correct; the body spread is the hole.

**Fix:** Replace the spread with an explicit allowlist of updatable fields, e.g. `const { title, emoji, instructions, ingredients, servings, ...} = body; const updateData = { title, emoji, instructions, ingredients, ..., updatedAt: new Date() };` — never spread raw `body` into `$set`. If global publishing is a real feature, gate it on `session.user.isAdmin` like the food-items route does.

### Important · Medium — user/settings POST writes the entire request settings object verbatim (mass-assignment)

`src/app/api/user/settings/route.ts:68`

The POST handler validates only `settings.themeMode` is a string (line 56), then writes the whole client-supplied object with `$set: { settings }` (line 68). This lets a client clobber any settings subkey on their own user document, including `settings.mealPlanSharing.invitations` and `settings.recipeSharing.invitations` — the very arrays the sharing/IDOR model reads to grant cross-user access (e.g. src/app/api/meal-plans/route.ts:40-49). Because access is granted from the _owner's_ invitations array, a user editing their own doc cannot inject themselves into someone else's grants, so this is not a direct cross-user read. But it does let a user forge accepted-invitation entries in their own document (granting others access to their own data outside the invite flow) and bypass all the validation in the dedicated invite routes. Self-scoped mass-assignment, not a cross-tenant leak.

**Fix:** Validate and allowlist the settings shape before persisting (e.g. accept only `themeMode` and other known display preferences via an explicit object), or update only the specific keys: `$set: { 'settings.themeMode': settings.themeMode, ... }`. Never persist a raw client object as the entire `settings` field; mutate sharing invitations only through the dedicated invite/accept routes.

### Important · Big-job — No server-side approval enforcement: unapproved authenticated users can call every data API

`src/middleware.ts:30`

Approval gating exists only as `if (!token)` in middleware (line 30) — it checks authentication, never `token.isApproved`. `isApproved` is cached in the JWT (src/lib/auth.ts:28,44) but no API route consults it: every handler gates solely on `if (!session?.user?.id)`. As a result a signed-in but unapproved user (one awaiting admin approval) can call every data route — create/read/update meal plans, recipes, pantry, stores, shopping lists, send sharing invites — with full access. The pending-approval screen is purely client-side. This is the known approval-gating gap; concrete instances are every route in src/app/api/ other than the admin routes (which separately gate on isAdmin). Severity capped at Important per REVIEW.md's single-user threat-model calibration, but it is a real authorization gap, not theoretical.

**Fix:** Enforce approval centrally: in middleware, after the `!token` check, redirect to /pending-approval when `token.isApproved !== true` for non-exempt paths; and/or add a shared `requireApprovedSession()` helper used by API handlers that returns 403 with AUTH_ERRORS.FORBIDDEN when `!session.user.isApproved`. The redesign spec is already tracking this — capture it as a backlog item with these citations.

## Test (14)

### Important · Medium — recipe-sharing-utils and meal-plan-sharing-utils are near-identical parallel modules

`src/lib/meal-plan-sharing-utils.ts:21`

## `src/lib/meal-plan-sharing-utils.ts` and `src/lib/recipe-sharing-utils.ts` are structurally identical: same 6 client fetch functions (invite, respond, remove, fetchPendingInvitations, fetchSharedUsers, fetchOwners) with bodies that differ only by the URL segment (`meal-plan-sharing` vs `recipe-sharing`) and a couple of error-message labels. Both also redeclare an identical `SharedUser` interface (see architecture-007). Per the 'two callers or near-duplicate sites' bar in the methodology, this is a duplicate-pattern abstraction: a single parameterized `createSharingClient('meal-plan-sharing' | 'recipe-sharing')` factory (or a small set of generic functions taking a resource segment) would collapse ~195 lines into one module. The matching server-side route trees (`api/user/recipe-sharing/*` and `api/user/meal-plan-sharing/*`) mirror the same duplication but are conventional Next.js route files — the client utils are the higher-leverage dedup.

There is no src/lib/**tests**/meal-plan-sharing-utils.test.ts. All six exported wrappers are untested: inviteUserToMealPlanSharing (line 21), respondToMealPlanSharingInvitation (35), removeUserFromMealPlanSharing (52), fetchPendingMealPlanSharingInvitations (61), fetchSharedMealPlanUsers (71), fetchMealPlanOwners (79). Note these differ from recipe-sharing: most throw fixed strings (e.g. line 57 'Failed to remove user from meal plan sharing') rather than reading error.error, and respondToMealPlanSharingInvitation interpolates the action into the message (line 48 `Failed to ${action} invitation`). Those distinctions are exactly what a behavioral test should pin. Async fetch wrappers -> MSW success/error coverage, not golden-master.

**Fix:** Introduce a shared sharing-client factory in `src/lib/` parameterized by resource segment, e.g. `makeSharingClient('recipe-sharing')` returning the 6 functions, and have both modules export thin wrappers. Or merge into one `sharing-utils.ts` with a `resource` arg. Keep `SharedUser` in `src/types/` (see architecture-007).

### Important · Medium — findNextAvailableMealPlanStartDate skip-advance loop is effectively untested (pure transform, golden-master candidate)

`src/lib/meal-plan-utils.ts:288`

The only test for this function (src/lib/**tests**/meal-plan-utils.test.ts:17-23) asserts solely that the returned startDate matches the regex /\d{4}-\d{2}-\d{2}/ — it never verifies the actual computed date, never asserts `skipped`/`skippedFrom`, and never exercises the conflict-advance loop at lines 288-309. Because the test seeds a far-future plan (2099) while `candidate` starts at `new Date()`, the overlap loop never runs, so the entire skip-advance branch (advance to day after conflict ends, re-seek target weekday) is dead code under test. This is the single highest-value pure-transform hardening target in the data layer: the loop has subtle re-entrancy (it calls checkMealPlanOverlap twice per iteration, lines 288 and 295) and a 7-day fallback branch (lines 304-308) that has never executed. Harden with deterministic tests using vi.setSystemTime to pin `new Date()`, then: (a) no plans -> returns the next target weekday with skipped=false; (b) one plan covering the immediate candidate -> asserts skipped=true, skippedFrom equals the original candidate, and startDate is the next free target-weekday after the conflict ends; (c) back-to-back plans forcing multiple loop iterations; (d) today already being the target weekday.

**Fix:** Add a describe block in src/lib/**tests**/meal-plan-utils.test.ts that wraps in vi.useFakeTimers()/vi.setSystemTime(new Date('2026-05-28')) (afterEach vi.useRealTimers()). Assert exact startDate strings, and assert skipped/skippedFrom for the overlap case. Cover the multi-conflict path so lines 288-309 execute at least twice in one call.

### Important · Medium — checkMealPlanOverlap edge cases untested: boundary touch, excludePlanId, non-string dates throw, empty startDate

`src/lib/meal-plan-utils.ts:38`

The sole test (src/lib/**tests**/meal-plan-utils.test.ts:9-15) checks one overlapping case. Untested branches in this pure function: the empty-startDate early return (line 46-48), the excludePlanId skip for updates (line 55-56), the throw when plan.startDate/endDate are not strings (line 60-62), adjacency/boundary cases where newStart === planEnd or planStart === newEnd (the isEqual arms at lines 68-69 — off-by-one bugs in meal-plan adjacency would slip through), and the non-overlapping return (line 82). This is the validation gate that prevents overlapping meal plans, so a boundary bug here is a real product defect.

**Fix:** Add cases: empty startDate -> {isOverlapping:false}; a plan whose endDate equals the new startDate (touching boundary) -> assert the intended behavior; excludePlanId matching the only conflicting plan -> {isOverlapping:false}; a plan with a Date (non-string) startDate -> expect(() => checkMealPlanOverlap(...)).toThrow(); fully-separate ranges -> {isOverlapping:false}.

### Important · Medium — shopping-list-utils: 10 of 12 fetch wrappers have no tests (15% coverage)

`src/lib/__tests__/shopping-list-utils.test.ts:5`

The test file imports only fetchPurchaseHistory and finishShop and tests just those two. The other 10 exported async wrappers in src/lib/shopping-list-utils.ts are untested: fetchStores (line 11), fetchStore (19), createStore (27), updateStore (42), deleteStore (57), fetchShoppingList (69), updateShoppingList (77), inviteUserToStore (96), respondToInvitation (110), removeUserFromStore (128), fetchPendingInvitations (137). These are the async fetch wrappers the audit brief flagged for MSW success/error coverage (NOT golden-master). The existing two-function block already establishes the correct pattern (MSW server.use override + rejects.toThrow). Each wrapper has a distinct error-message branch (e.g. createStore reads error.error || 'Failed to create store' at line 38, while deleteStore throws a fixed string at line 64) — verifying the right message surfaces is the behavioral assertion.

**Fix:** Extend the existing MSW-based test file (do NOT vi.stubGlobal fetch — MSW is active). For each wrapper add a success test asserting the parsed JSON and an error test (server.use a 4xx/5xx) asserting rejects.toThrow with the expected message. Prioritize createStore/updateStore/deleteStore and the invitation wrappers (respondToInvitation, removeUserFromStore) since they carry ownership semantics.

### Important · Medium — recipe-sharing-utils.ts has no test file (6 untested fetch wrappers, ~0.8% coverage)

`src/lib/recipe-sharing-utils.ts:26`

There is no src/lib/**tests**/recipe-sharing-utils.test.ts. All six exported async wrappers are untested: inviteUserToRecipeSharing (line 26), respondToRecipeSharingInvitation (46), removeUserFromRecipeSharing (66), fetchPendingRecipeSharingInvitations (79), fetchSharedRecipeUsers (91), fetchRecipeSharingOwners (103). Per the audit brief these are async fetch wrappers needing MSW success/error coverage, not golden-master. Each has an error branch that reads error.error || '<fallback>'; the behavioral check is that the fetched payload is returned on success and the correct message is thrown on failure. Sharing flows are multi-user and ownership-sensitive, so error-path confidence matters here.

**Fix:** Create src/lib/**tests**/recipe-sharing-utils.test.ts following the shopping-list-utils MSW pattern (import { server } from '../../../vitest.setup', server.use per test). One success + one error test per wrapper; assert the returned shape for the three fetch\* functions and rejects.toThrow for all six.

### Important · Medium — shopping-list-position-utils.ts has no test file — pure position math is untested

`src/lib/shopping-list-position-utils.ts:84`

No test file exists for this module, yet it contains genuinely pure, branchy transform logic that is a strong golden-master candidate: insertItemAtPosition (line 84) handles null position -> append, empty list, and a rounded target index clamped to [0,length]; saveItemPositions (line 48) computes relative positions with a single-item special case (0.5 at line 58) and a clamp to [0,1] (line 61); insertItemsWithPositions (line 114) sorts existing+new items by remembered position and interleaves them. Off-by-one or sort-stability bugs in shopping-list ordering would be invisible today. The two async functions (getItemPosition, getStorePositions) swallow errors and return null/empty Map — those need MSW error-path coverage to confirm the swallow behavior is intentional and the Map-building loop (lines 33-37) works.

**Fix:** Create src/lib/**tests**/shopping-list-position-utils.test.ts. Pure tests (no mocks) for insertItemAtPosition (null position appends; position 0 -> front; position 1 -> end; empty list) and saveItemPositions position math (assert the POST body via MSW or refactor to expose the calc) and clamping. Add MSW tests for getItemPosition/getStorePositions returning null/empty Map on non-ok and on thrown fetch, and a happy-path that builds the Map from data.positions.

### Important · Medium — recipe-user-data-utils.ts has no test file — batch Map-building and empty-input short-circuit untested

`src/lib/recipe-user-data-utils.ts:18`

No test file exists. fetchRecipeUserDataBatch (line 18) has a behavioral short-circuit — returns an empty Map without fetching when recipeIds is empty (line 21) — and builds a Map from Object.entries(data) (line 33); neither the short-circuit nor the Map construction is tested. The other wrappers (fetchRecipeUserData line 6, updateRecipeTags line 39, updateRecipeRating line 60, deleteRecipeRating line 81, fetchUserTags line 94) are also untested. fetchUserTags has a defaulting branch `data.tags || []` (line 101) worth a test (response with no tags key -> []). These are fetch wrappers -> MSW coverage.

**Fix:** Create src/lib/**tests**/recipe-user-data-utils.test.ts. Assert fetchRecipeUserDataBatch([]) resolves to an empty Map AND that no request fired (use a spy/MSW handler that records calls). Add success+error MSW tests for each wrapper and a fetchUserTags test where the response omits `tags` -> expect [].

### Important · Medium — Sharing/store API routes have no route tests — auth (401), bad-input (400), and ownership paths uncovered

`src/app/api/stores/[id]/route.ts:1`

A cluster of API routes that all call getServerSession (verified) have no **tests**/route.test.ts: src/app/api/stores/[id]/route.ts (4 getServerSession calls; GET/PUT/DELETE on a single store — prime IDOR/ownership surface), src/app/api/stores/invitations/route.ts, src/app/api/stores/[id]/invite/route.ts, src/app/api/stores/[id]/invitations/[userId]/route.ts, src/app/api/shopping-lists/[storeId]/route.ts, src/app/api/shopping-lists/[storeId]/positions/route.ts, src/app/api/recipes/tags/route.ts, src/app/api/recipes/[id]/user-data/route.ts, and the four meal-plan-sharing routes plus three recipe-sharing routes (shared-users/owners/invitations + [userId]). Per the test-reviewer coverage-strategy rule, each route handler with auth needs at minimum a 401 (getServerSession -> null), a 400 for handlers that validate (ObjectId / required fields), a success path, and one error path. These routes carry ownership and invitation-accept/reject logic where a missing userId filter would silently expose other users' data — exactly the IDOR class REVIEW.md tells reviewers to prioritize for this solo-user-but-multi-share app.

**Fix:** Add **tests**/route.test.ts per route using the documented pattern (docs/testing.md sections 3-4): vi.mock('next-auth/next'), vi.mock('@/lib/auth', () => ({ authOptions: {} })), vi.mock('@/lib/mongodb-adapter', () => ({ default: Promise.resolve({}) })), the chainable @/lib/mongodb mock, and a full @/lib/errors mock (all groups the route imports). Start each suite with the 401 case, then bad-input (invalid ObjectId / missing required field) -> 400, then success, then a DB-throw -> 500. Prioritize stores/[id] and the invitation [userId] routes (accept/reject ownership).

### Minor · Quick — `use-approval-status.ts` hook lives in `src/lib/` instead of `src/lib/hooks/`

`src/lib/use-approval-status.ts:1`

## CLAUDE.md (Project Structure + Conventions) states custom React hooks live in `src/lib/hooks/`. All ten other hooks (`use-dialog`, `use-debounced-search`, `use-food-items`, `use-food-item-creator`, `use-food-item-selector`, `use-quantity-input`, `use-search-pagination`, `use-server-pagination`, `use-shopping-sync`, plus the barrel `index.ts`) are in `src/lib/hooks/`. `use-approval-status.ts` is the lone hook sitting directly in `src/lib/`. This is location/naming drift.

Untested hooks/utilities with non-trivial logic and no test file: src/lib/use-approval-status.ts (81 lines — polls approval status, has fetch + state branches), src/lib/hooks/use-food-item-creator.ts (135 lines — creates food items, error handling), src/lib/hooks/use-quantity-input.ts (71 lines — input parsing/validation), src/lib/hooks/use-search-pagination.ts (105 lines), src/lib/hooks/use-dialog.ts (195 lines). use-food-item-creator and use-quantity-input contain the most behavior worth testing (creation error paths; quantity parse/clamp). These can use the TestComponent harness pattern documented in docs/testing.md section 6 (already used by use-food-items and use-shopping-sync tests).

**Fix:** Move `src/lib/use-approval-status.ts` to `src/lib/hooks/use-approval-status.ts`, add it to `src/lib/hooks/index.ts`, and update its importers.

### Minor · Medium — recipe-utils.ts has no test file — Array-vs-paginated normalization untested

`src/lib/recipe-utils.ts:3`

No test file exists. fetchRecipes (line 3), fetchUserRecipes (12), and fetchGlobalRecipes (21) each contain the normalization `Array.isArray(json) ? json : json.data || []` (lines 9, 18, 32) which silently coerces both a bare array and a {data:[...]} paginated envelope. This dual-shape handling is a real behavioral branch that no test exercises. fetchGlobalRecipes also builds a different URL based on excludeUserCreated (lines 24-26). Async fetch wrappers -> MSW coverage.

**Fix:** Create src/lib/**tests**/recipe-utils.test.ts. For fetchRecipes, add one test where MSW returns a bare array and one where it returns { data: [...] }, asserting both normalize to the same array; add a non-ok error test. For fetchGlobalRecipes assert the request URL carries excludeUserCreated=true only when the flag is set.

### Minor · Medium — pantry-utils.ts has no test file — fetchPantryItems unwraps result.data untested (9% coverage)

`src/lib/pantry-utils.ts:3`

No test file exists for this module (the audit baseline reports 9% coverage). fetchPantryItems (line 3) returns result.data — unwrapping the paginated envelope — which is a behavioral transform that no test covers; createPantryItem (12) and deletePantryItem (31) have the standard error.error || fallback branches. Async fetch wrappers -> MSW coverage, not golden-master.

**Fix:** Create src/lib/**tests**/pantry-utils.test.ts. Assert fetchPantryItems returns the inner .data array (MSW returns { data: [...] }); add error tests for all three wrappers asserting the thrown message.

### Minor · Medium — user-utils.test.ts does not cover getCurrentUserAdminStatus (58% coverage)

`src/lib/__tests__/user-utils.test.ts:17`

The test file only exercises getUserObjectId. The second exported function, getCurrentUserAdminStatus (src/lib/user-utils.ts:19), is untested — that gap is the 58% coverage. It has three behavioral branches: no session/email -> returns false (line 21), a user with isAdmin !== true -> false, and isAdmin === true -> true (line 28). Admin gating is security-relevant, so the false-on-no-session and false-on-non-admin paths deserve explicit assertions. The file already mocks @/lib/mongodb; it additionally needs the next-auth/next and @/lib/auth mocks per docs/testing.md section 3b.

**Fix:** Add a describe('getCurrentUserAdminStatus') block. vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() })) and vi.mock('@/lib/auth', () => ({ authOptions: {} })) at top level. Test: getServerSession -> null session => false; session present + findOne returns { isAdmin: true } => true; findOne returns { isAdmin: false } or null => false.

### Minor · Medium — date-utils.test.ts misses dayOfWeekToIndex branches, getNextDayOfWeekAsString, and getTodayAsString (76% coverage)

`src/lib/__tests__/date-utils.test.ts:10`

Pure functions with untested branches: dayOfWeekToIndex (src/lib/date-utils.ts:30) has 8 switch arms including the default fallback (line 46) — none are asserted; getNextDayOfWeekAsString (line 56, the string variant) and its week-wrap branch (daysToAdd <= 0 -> +7, line 66) are untested; getTodayAsString (line 23) and parseLocalDate (line 8) have no direct tests. These are deterministic pure transforms — cheap to lock down and exactly the kind of off-by-one date logic the meal-plan layer depends on.

**Fix:** Add a table-driven test for dayOfWeekToIndex covering all 7 days plus an invalid input -> 0. Add getNextDayOfWeekAsString tests under vi.setSystemTime for: today === target (returns today) and today after target (wraps +7). Add a getTodayAsString test asserting it equals formatDateForAPI(new Date()) under a pinned clock.

### Minor · Medium — auth.ts callbacks untested — redirect() is a pure, security-relevant function (44% coverage)

`src/lib/auth.ts:47`

There is no test for the NextAuth callbacks. The redirect callback (src/lib/auth.ts:47) is pure and security-relevant (open-redirect guard): relative URL -> baseUrl+url (line 48), same-origin absolute URL -> url (line 49), cross-origin -> baseUrl (line 50). The session callback (line 38) is also pure (maps token.isAdmin/isApproved booleans onto session.user). The jwt callback (line 19) touches Mongo but its error path (line 29-33) sets isAdmin/isApproved to false on DB failure — a behavior worth pinning. These can be tested by importing authOptions and invoking authOptions.callbacks.redirect/session directly.

**Fix:** Create src/lib/**tests**/auth.test.ts. Mock @/lib/mongodb and @/lib/mongodb-adapter to avoid import-time connection. Test redirect: '/dashboard' -> baseUrl+'/dashboard'; same-origin absolute -> unchanged; 'https://evil.com' -> baseUrl. Test session: token { isAdmin:true, isApproved:false, sub:'u1' } maps onto session.user.id/isAdmin/isApproved. Test jwt error path: getMongoClient rejects -> token.isAdmin===false && token.isApproved===false.

## Architecture (7)

### Important · Medium — populateMealItemName duplicated across two meal-plan routes; [id] version does N+1 DB queries

`src/app/api/meal-plans/[id]/route.ts:60`

A `populateMealItemName` helper is defined inline in BOTH `src/app/api/meal-plans/route.ts:118` (batch version: collects all foodItem/recipe IDs, does one `$in` fetch each, populates from a Map) and `src/app/api/meal-plans/[id]/route.ts:60` (per-item version: calls `foodItemsCollection.findOne(...)` once per ingredient — an N+1 query for every foodItem/recipe across every meal/group). The two share the exact same shape logic (quantity===1 ? singularName : pluralName, recipe.title fallback, ingredientGroup recursion) but have diverged in fetch strategy. This is the canonical 'business logic in route handlers' / abstraction-duplication smell: the name-population transform is domain logic, not HTTP concern. Extract a single `populateMealPlanItemNames(items, foodItemMap, recipeMap)` (pure, Map-based) into `src/lib/meal-plan-utils.ts`, and have both routes pre-fetch referenced docs via `$in` then call it. The [id] route's N+1 disappears as a side effect.

**Fix:** Extract the batch (Map-based) populate logic into `src/lib/meal-plan-utils.ts` as a pure function `populateMealPlanItemNames(items, foodItemMap, recipeMap)`. Both routes build the lookup Maps via a single `$in` query (as the list route already does at route.ts:101-115) and call the shared util. This dedups ~130 lines and removes the N+1 in the [id] handler.

### Important · Medium — meal-plans GET handler holds ~165 lines of business logic inline

`src/app/api/meal-plans/route.ts:20`

The GET handler (lines 20-189) is ~170 lines and mixes four concerns: (1) shared-owner resolution via a `users` query, (2) date-range filter construction, (3) reference-ID collection by walking nested meal/ingredient-group structures (lines 78-98), and (4) the `populateMealItemName` transform (lines 118-182). Per the agent methodology, a route handler with >30 lines of multi-collection-join + derived-transform logic should delegate to `src/lib/*-utils.ts` (cf. `meal-plan-utils.ts`, `food-items-utils.ts`). The ID-collection walk and the populate transform are pure functions of the data and should move to `meal-plan-utils.ts`, leaving the handler to orchestrate session-check, queries, and response.

**Fix:** Move the reference-ID collection (lines 75-98) and the name-population transform (lines 117-182) into `src/lib/meal-plan-utils.ts` as `collectMealPlanRefIds(plans)` and `populateMealPlanItemNames(...)`. Keep the route handler as session-check + filter-build + queries + call utils + respond, mirroring the recipes route which already extracts `buildBaseFilter`/`addTextSearch`.

### Important · Medium — recipe-sharing-utils and meal-plan-sharing-utils are near-identical parallel modules

`src/lib/meal-plan-sharing-utils.ts:21`

## `src/lib/meal-plan-sharing-utils.ts` and `src/lib/recipe-sharing-utils.ts` are structurally identical: same 6 client fetch functions (invite, respond, remove, fetchPendingInvitations, fetchSharedUsers, fetchOwners) with bodies that differ only by the URL segment (`meal-plan-sharing` vs `recipe-sharing`) and a couple of error-message labels. Both also redeclare an identical `SharedUser` interface (see architecture-007). Per the 'two callers or near-duplicate sites' bar in the methodology, this is a duplicate-pattern abstraction: a single parameterized `createSharingClient('meal-plan-sharing' | 'recipe-sharing')` factory (or a small set of generic functions taking a resource segment) would collapse ~195 lines into one module. The matching server-side route trees (`api/user/recipe-sharing/*` and `api/user/meal-plan-sharing/*`) mirror the same duplication but are conventional Next.js route files — the client utils are the higher-leverage dedup.

There is no src/lib/**tests**/meal-plan-sharing-utils.test.ts. All six exported wrappers are untested: inviteUserToMealPlanSharing (line 21), respondToMealPlanSharingInvitation (35), removeUserFromMealPlanSharing (52), fetchPendingMealPlanSharingInvitations (61), fetchSharedMealPlanUsers (71), fetchMealPlanOwners (79). Note these differ from recipe-sharing: most throw fixed strings (e.g. line 57 'Failed to remove user from meal plan sharing') rather than reading error.error, and respondToMealPlanSharingInvitation interpolates the action into the message (line 48 `Failed to ${action} invitation`). Those distinctions are exactly what a behavioral test should pin. Async fetch wrappers -> MSW success/error coverage, not golden-master.

**Fix:** Introduce a shared sharing-client factory in `src/lib/` parameterized by resource segment, e.g. `makeSharingClient('recipe-sharing')` returning the 6 functions, and have both modules export thin wrappers. Or merge into one `sharing-utils.ts` with a `resource` arg. Keep `SharedUser` in `src/types/` (see architecture-007).

### Important · Big-job — shopping-lists/page.tsx is a 2885-line monolith (single client component)

`src/app/shopping-lists/page.tsx:139`

The entire shopping-list feature lives in one `ShoppingListsPageContent` client component spanning ~2700 lines (file is 2885 total) with 43 hook calls. This is the largest file in src/ by a wide margin and far exceeds the 500-line threshold in the agent methodology. It interleaves store selection, dnd-kit reordering, item editing, add-from-pantry/meal-plan flows, sync state, and several dialogs. NOTE: this component is on the dark-mode-redesign rewrite list, so this finding primarily informs that rewrite — the right move is to decompose during the rewrite rather than a separate refactor pass. Concrete seams to split along: a `useShoppingListPage` container hook for state/sync orchestration, and sub-components for the store header, the draggable item list, and the add-item flows. The dnd-kit list and the add-from-meal-plan flow are the two most self-contained extractions.

**Fix:** During the planned redesign rewrite, decompose into a container hook (`useShoppingListPage`) plus presentation sub-components (store header, draggable list rows, add-item dialogs). Target <300 lines per component. Do not attempt a big-bang extract before the rewrite — coordinate with the redesign chunks.

### Minor · Quick — SharedUser interface defined identically in two lib files instead of src/types/

`src/lib/recipe-sharing-utils.ts:1`

The `SharedUser` interface (`{ userId: string; email: string; name?: string }`) is declared identically in both `src/lib/recipe-sharing-utils.ts:1` and `src/lib/meal-plan-sharing-utils.ts:1`. A domain shape used by 2+ features belongs in `src/types/`, per the module-coupling guidance, not redefined inline in each util. The two `Pending*Invitation` interfaces are also closely parallel and could share a base shape, though they differ enough (recipe vs meal-plan invitation fields) that consolidating them is optional.

**Fix:** Move `SharedUser` to `src/types/` (e.g. a `sharing.ts` type module) and import it in both sharing-utils files. Fold this into the architecture-006 dedup if that refactor is taken.

### Minor · Big-job — meal-plans, recipes, and food-items pages each exceed 500 lines as single client components

`src/app/meal-plans/page.tsx:94`

Three feature pages are single monolithic client components well past the 500-line threshold: `meal-plans/page.tsx` (1372 lines, 30 state/effect hooks in `MealPlansPageContent`), `recipes/page.tsx` (1153 lines, ~30 hooks in `RecipesPageContent`), and `food-items/page.tsx` (847 lines). Each mixes data fetching, filter/search state, pagination, dialog orchestration, and large JSX trees in one function. All three are on the dark-mode-redesign rewrite list, so flagging here is to inform the rewrite: each should grow a container hook (e.g. `useMealPlansPage`) and extract the list/grid and the dialog-orchestration into sub-components, matching the `optimized/` and `food-item-inputs/` extraction precedent. Grouped as one Minor since they are facets of the same 'page-as-monolith' pattern.

**Fix:** As each page is rewritten for dark mode, extract a container hook for state/data orchestration and pull the list/grid + dialog wiring into sub-components, targeting <400 lines per file. Cite this same decomposition approach across all three.

### Minor · Big-job — MealPlanViewDialog is an 848-line single component

`src/components/MealPlanViewDialog.tsx:68`

`MealPlanViewDialog` is 848 lines in one component (`MealPlanViewDialogProps` -> single arrow component starting line 68), exceeding the 500-line threshold. It renders the meal-plan view, embeds recipe-view behavior (there is a dedicated test `MealPlanViewDialog-recipe-view.test.tsx`), and handles edit affordances. This is on the redesign rewrite list. The recipe-view-within-meal-plan concern and the day/meal rendering are natural sub-component extractions. Flagging to inform the rewrite, not as urgent standalone debt.

**Fix:** During the redesign, extract the per-day/per-meal rendering and the embedded recipe-view into sub-components; consider whether RecipeViewDialog can be reused directly instead of re-implementing recipe rendering here.

## A11y (7)

### Important · Quick — Star-rating IconButtons have no accessible name

`src/components/RecipeStarRating.tsx:50`

In editable mode the rating control renders five IconButtons (lines 50-65), each containing only a <Star /> or <StarBorder /> icon with no aria-label and no title. Screen reader users hear 'button' five times with no indication of value or purpose, so the rating control is effectively unusable without sight. RecipeStarRating is not on the rewrite list.

**Fix:** Add aria-label={`Rate ${value} star${value === 1 ? '' : 's'}`} to each IconButton (value is already in scope in the map). Optionally add aria-pressed={value <= displayRating} to convey current selection.

### Important · Medium — Emoji grid cells are non-keyboard-accessible clickable Boxes

`src/components/EmojiPicker.tsx:243`

Each emoji in the picker grid is a <Box onClick={...}> (line 243) rendering as a plain div. It has no role="button", no tabIndex={0}, and no onKeyDown handler, so keyboard-only users cannot focus or activate any emoji — the picker is mouse/touch-only. It does carry a title attribute, but that does not make it focusable or operable. EmojiPicker is launched from RecipeEditorDialog and is not on the rewrite list.

**Fix:** Replace the clickable Box with a MUI <ButtonBase> (or add role="button", tabIndex={0}, and an onKeyDown that fires handleEmojiSelect on Enter/Space) and give it aria-label={item.description}.

### Minor · Quick — Delete IconButton on pantry rows has no aria-label

`src/app/pantry/page.tsx:223`

The pantry table-row delete control (line 223) and the mobile-card delete control (line 262) are icon-only IconButtons containing <Delete /> with no aria-label. Screen reader users hear 'button' with no indication it deletes the pantry item. Pantry is not on the rewrite list. (Two occurrences: lines 223 and 262.)

**Fix:** Add aria-label={`Remove ${item.foodItem.pluralName} from pantry`} to both IconButtons.

### Minor · Quick — Emoji-picker trigger IconButton has no accessible name

`src/components/RecipeEditorDialog.tsx:84`

The emoji-picker trigger (line 84) is an IconButton showing recipe.emoji or an <EmojiEmotions /> fallback with no aria-label. When no emoji is set, screen reader users hear only 'button'. Secondary issue: the button uses a hardcoded border '1px solid #ccc' (line 87) instead of a theme border color, so it does not track dark mode. RecipeEditorDialog itself is not flagged for rewrite (RecipeViewDialog is).

**Fix:** Add aria-label="Choose recipe emoji" to the IconButton; replace border: '1px solid #ccc' with borderColor: 'divider' (e.g. border: 1, borderColor: 'divider').

### Minor · Quick — Sharing-list action IconButtons rely on title instead of aria-label

`src/components/RecipeSharingSection.tsx:99`

The Accept (line 99), Reject (line 107), and Remove-user (line 203) IconButtons are icon-only and provide their name only via the title attribute. title is the lowest-priority source for the accessible name and is not announced consistently across screen readers; aria-label is the reliable choice. The same pattern appears in src/app/meal-plans/page.tsx at lines 857 (Accept), 865 (Reject), and 1309 (Remove user). None of these surfaces are on the rewrite list.

**Fix:** Add aria-label matching the existing title text to each IconButton (e.g. aria-label="Accept invitation", aria-label="Reject invitation", aria-label="Remove user"). Keep title if a tooltip is desired.

### Minor · Quick — IngredientGroup delete IconButton has no accessible name

`src/components/IngredientGroup.tsx:112`

The remove-group control (line 112) is an icon-only IconButton containing <Delete /> with no aria-label. Screen reader users hear 'button' with no purpose. Note this button is hidden on mobile (display xs:none, sm:flex), limiting impact on the primary touch path. IngredientGroup is used by recipe/ingredient editing surfaces; it is not itself on the rewrite list (MealEditor is).

**Fix:** Add aria-label="Remove ingredient group" to the IconButton.

### Minor · Quick — IngredientInput delete IconButton has no accessible name

`src/components/IngredientInput.tsx:275`

The remove-ingredient control (line 275) is an icon-only IconButton containing <Delete /> with no aria-label. Screen reader users hear 'button' with no purpose. It is hidden on mobile (display xs:none, sm:flex). IngredientInput is shared across editing surfaces; MealEditor (a consumer) is slated for rewrite, so the value of fixing this here is partial — but IngredientInput itself is not on the rewrite list.

**Fix:** Add aria-label="Remove ingredient" to the IconButton.

## Code (6)

### Minor · Quick — Unnecessary `as` casts on session.user contradict CLAUDE.md typed-session rule

`src/components/AdminOnly.tsx:13`

CLAUDE.md states explicitly: "Session user has typed `id`, `isAdmin`, `isApproved` properties — never use `as` casts." `src/types/next-auth.d.ts` already augments `Session['user']` with `id: string`, `isAdmin: boolean`, `isApproved: boolean`. Five sites still cast the session shape anyway, which is both unnecessary and a direct convention violation: `src/components/AdminOnly.tsx:13` (`session?.user as { isAdmin?: boolean }`), `src/lib/use-approval-status.ts:39` and `:40` (`as { isApproved?: boolean }` / `as { isAdmin?: boolean }`), `src/app/shopping-lists/page.tsx:274` (`session.user as { name?: string }` — `name` is already `string | null` on the type), and `src/app/recipes/page.tsx:687` (`session?.user as Session['user']` — a self-cast that is a pure no-op). This is drift: the rest of the codebase (food-items/page.tsx:80, BottomNav.tsx, Header.tsx, all API routes) accesses `session.user.isAdmin`/`isApproved`/`id` directly without casts.

**Fix:** Delete the casts and access the properties directly: `session?.user?.isAdmin`, `currentSession?.user?.isApproved`, `session.user.name`, `session?.user?.id`. No cast is needed because the next-auth module augmentation already types these fields.

### Minor · Quick — Hardcoded error strings in several API routes instead of `@/lib/errors` constants

`src/app/api/recipes/[id]/rating/route.ts:30`

CLAUDE.md mandates error constants from `@/lib/errors` (never hardcode error strings), and 43 of 44 API routes follow this. A cluster of newer endpoints inline raw strings instead: `src/app/api/recipes/[id]/rating/route.ts:30` ('Rating must be an integer between 1 and 5') and `:109` ('Rating not found'); `src/app/api/recipes/[id]/tags/route.ts:29` ('Tags must be an array') and `:34` ('All tags must be strings'); `src/app/api/recipes/route.ts:235` and `src/app/api/recipes/[id]/route.ts:143` (both 'Group titles are required for non-standalone ingredient groups'); `src/app/api/shopping-lists/[storeId]/positions/route.ts:107,113,117,122` ('Positions must be an array', etc.); `src/app/api/avatar/route.ts:15,20`; and `src/app/api/meal-plans/route.ts:229` ('You do not have permission to create meal plans for this user' — note `MEAL_PLAN`/generic constants exist but none matches this exact message). No matching constants currently exist for most of these, so the fix is to add them to the relevant `*_ERRORS` group in `src/lib/errors.ts` and reference them.

**Fix:** Add the missing messages as constants to the appropriate group in `src/lib/errors.ts` (e.g. a `RATING_ERRORS` / extend `RECIPE_ERRORS`, `SHOPPING_LIST_ERRORS`) and replace the inline strings with the constant references.

### Minor · Quick — `use-approval-status.ts` hook lives in `src/lib/` instead of `src/lib/hooks/`

`src/lib/use-approval-status.ts:1`

## CLAUDE.md (Project Structure + Conventions) states custom React hooks live in `src/lib/hooks/`. All ten other hooks (`use-dialog`, `use-debounced-search`, `use-food-items`, `use-food-item-creator`, `use-food-item-selector`, `use-quantity-input`, `use-search-pagination`, `use-server-pagination`, `use-shopping-sync`, plus the barrel `index.ts`) are in `src/lib/hooks/`. `use-approval-status.ts` is the lone hook sitting directly in `src/lib/`. This is location/naming drift.

Untested hooks/utilities with non-trivial logic and no test file: src/lib/use-approval-status.ts (81 lines — polls approval status, has fetch + state branches), src/lib/hooks/use-food-item-creator.ts (135 lines — creates food items, error handling), src/lib/hooks/use-quantity-input.ts (71 lines — input parsing/validation), src/lib/hooks/use-search-pagination.ts (105 lines), src/lib/hooks/use-dialog.ts (195 lines). use-food-item-creator and use-quantity-input contain the most behavior worth testing (creation error paths; quantity parse/clamp). These can use the TestComponent harness pattern documented in docs/testing.md section 6 (already used by use-food-items and use-shopping-sync tests).

**Fix:** Move `src/lib/use-approval-status.ts` to `src/lib/hooks/use-approval-status.ts`, add it to `src/lib/hooks/index.ts`, and update its importers.

### Minor · Medium — Feature page.tsx files use deep relative imports instead of `@/` alias

`src/app/meal-plans/page.tsx:43`

66 non-test files use the `@/` path alias; only 16 still use deep relative imports (`../../`, up to `../../../../`). The offenders cluster in the seven feature page files — `src/app/meal-plans/page.tsx` (lines 43,52,53,64,66,67,72,77,87,91,92), `src/app/shopping-lists/page.tsx` (69,74,88,103,104,108,109,110,116,122,124,125), `src/app/recipes/page.tsx` (36,37,38,46,47), `src/app/settings/page.tsx` (20,21,22), `src/app/pantry/page.tsx` (24,25,26), `src/app/food-items/page.tsx` (36), `src/app/pending-approval/page.tsx` (6), `src/app/user-management/page.tsx` (30) — plus a handful of admin/user API routes (`src/app/api/admin/users/route.ts`, `approve/route.ts`, `toggle-admin/route.ts`, `pending/route.ts`, `user/settings/route.ts`, `recipes/route.ts`, `recipes/[id]/route.ts`, `auth/[...nextauth]/route.ts`). Since 43 of 49 API routes and the dominant share of files use `@/`, these are genuine drift, not consistency. Note: most of these page files are slated for the dark-mode UI redesign, so the page-level imports may be rewritten soon — the API-route relative imports are the more durable fix.

**Fix:** Replace `'../../lib/x'` / `'../../../../lib/auth'` style imports with the `@/lib/x` alias. Prioritize the API routes (admin/users/\*, user/settings, recipes) since the page files will likely be rewritten in the redesign.

### Nit · Quick — ItemEditorDialog uses `type ...Props = {}` where every other component uses `interface`

`src/components/shopping-list/ItemEditorDialog.tsx:46`

CLAUDE.md Code Style: "prefer interfaces over type aliases". 27 component files declare props with `interface XProps`; exactly one (`src/components/shopping-list/ItemEditorDialog.tsx`) declares object-shape aliases with `export type ItemEditorDraft = { ... }` (line 31) and `export type ItemEditorDialogProps = { ... }` (line 46). These are plain object shapes (no unions/intersections that would justify `type`), so they should be interfaces for consistency. (Note: the `type RouteParams = { ... }` alias repeated across 10 API route files is a consistent established pattern and is NOT flagged.)

**Fix:** Convert `export type ItemEditorDraft` and `export type ItemEditorDialogProps` to `export interface` declarations.

### Nit · Medium — `as any` on MongoDB `$pull`/`$push` update operators in sharing/invite routes

`src/app/api/stores/[id]/invite/route.ts:72`

CLAUDE.md prefers `unknown` over `any`. Seven `as any` casts suppress the MongoDB driver's update-operator typing for array `$pull`/`$push`: `src/app/api/stores/[id]/invite/route.ts:72,88`; `src/app/api/stores/[id]/invitations/[userId]/route.ts:119`; `src/app/api/user/meal-plan-sharing/invitations/[userId]/route.ts:107,116`; `src/app/api/user/recipe-sharing/invitations/[userId]/route.ts:107,116`. Each is annotated with an `eslint-disable @typescript-eslint/no-explicit-any` comment, so they are deliberate and consistent across the sharing routes — a known driver-typing workaround rather than careless `any`. Low priority; flagged only because `as any` is the one cast the convention calls out by name. A typed `UpdateFilter<T>` or a narrow `Record<string, ...>` annotation would remove the suppression.

**Fix:** Optional: type the collections with their document interfaces and use `UpdateFilter<StoreDoc>` so the `$pull`/`$push` shapes type-check without `as any`. If left as-is, this is acceptable as a consistent, annotated driver workaround.

## Dependencies (19)

### Important · Quick — Vulnerable dependency: flatted (high)

`package.json:5`

flatted vulnerable to unbounded recursion DoS in parse() revive phase. Affected: flatted@<=3.4.1. Direct: false. Advisory: https://github.com/advisories/GHSA-25h7-pfq9-p65f fixAvailable: true

**Fix:** Run `npm audit fix`.

### Important · Quick — Vulnerable dependency: glob (high)

`package.json:6`

glob CLI: Command injection via -c/--cmd executes matches with shell:true. Affected: glob@10.2.0 - 10.4.5. Direct: false. Advisory: https://github.com/advisories/GHSA-5j98-mcp5-4vw2 fixAvailable: true

**Fix:** Run `npm audit fix`.

### Important · Quick — Vulnerable dependency: lodash (high)

`package.json:8`

Lodash has Prototype Pollution Vulnerability in `_.unset` and `_.omit` functions. Affected: lodash@<=4.17.23. Direct: false. Advisory: https://github.com/advisories/GHSA-xxjr-mmjv-4gpg fixAvailable: true

**Fix:** Run `npm audit fix`.

### Important · Quick — Vulnerable dependency: minimatch (high)

`package.json:9`

minimatch has a ReDoS via repeated wildcards with non-matching literal in pattern. Affected: minimatch@<=3.1.3 || 9.0.0 - 9.0.6. Direct: false. Advisory: https://github.com/advisories/GHSA-3ppc-4f35-3m26 fixAvailable: true

**Fix:** Run `npm audit fix`.

### Important · Quick — Vulnerable dependency: next (high)

`package.json:10`

Next.js self-hosted applications vulnerable to DoS via Image Optimizer remotePatterns configuration. Affected: next@9.3.4-canary.0 - 16.3.0-canary.5. Direct: true. Advisory: https://github.com/advisories/GHSA-9g9p-9gw9-jx7f fixAvailable: {"name":"next","version":"15.5.18","isSemVerMajor":false}

**Fix:** Bump per advisory (may be breaking: next@15.5.18, semverMajor=false).

### Important · Quick — Vulnerable dependency: picomatch (high)

`package.json:12`

Picomatch: Method Injection in POSIX Character Classes causes incorrect Glob Matching. Affected: picomatch@<=2.3.1 || 4.0.0 - 4.0.3. Direct: false. Advisory: https://github.com/advisories/GHSA-3v7f-55p6-f55p fixAvailable: true

**Fix:** Run `npm audit fix`.

### Important · Quick — Vulnerable dependency: rollup (high)

`package.json:14`

Rollup 4 has Arbitrary File Write via Path Traversal. Affected: rollup@4.0.0 - 4.58.0. Direct: false. Advisory: https://github.com/advisories/GHSA-mw96-cpmx-2vgc fixAvailable: true

**Fix:** Run `npm audit fix`.

### Important · Quick — Vulnerable dependency: vite (high)

`package.json:17`

Vite middleware may serve files starting with the same name with the public directory. Affected: vite@7.0.0 - 7.3.1. Direct: true. Advisory: https://github.com/advisories/GHSA-g4jq-h2w9-997c fixAvailable: true

**Fix:** Run `npm audit fix`.

### Minor · Quick — Vulnerable dependency: ajv (moderate)

`package.json:2`

ajv has ReDoS when using `$data` option. Affected: ajv@<6.14.0. Direct: false. Advisory: https://github.com/advisories/GHSA-2g4f-4pwh-qvx6 fixAvailable: true

**Fix:** Run `npm audit fix`.

### Minor · Quick — Vulnerable dependency: brace-expansion (moderate)

`package.json:3`

brace-expansion: Zero-step sequence causes process hang and memory exhaustion. Affected: brace-expansion@<1.1.13 || >=2.0.0 <2.0.3. Direct: false. Advisory: https://github.com/advisories/GHSA-f886-m6hf-6m8v fixAvailable: true

**Fix:** Run `npm audit fix`.

### Minor · Quick — Vulnerable dependency: esbuild (moderate)

`package.json:4`

esbuild enables any website to send any requests to the development server and read the response. Affected: esbuild@<=0.24.2. Direct: false. Advisory: https://github.com/advisories/GHSA-67mh-4wv8-2f99 fixAvailable: {"name":"tsx","version":"4.22.3","isSemVerMajor":false}

**Fix:** Bump per advisory (may be breaking: tsx@4.22.3, semverMajor=false).

### Minor · Quick — Vulnerable dependency: js-yaml (moderate)

`package.json:7`

js-yaml has prototype pollution in merge (<<). Affected: js-yaml@4.0.0 - 4.1.0. Direct: false. Advisory: https://github.com/advisories/GHSA-mh29-5h37-fv8m fixAvailable: true

**Fix:** Run `npm audit fix`.

### Minor · Quick — Vulnerable dependency: next-auth (moderate)

`package.json:11`

NextAuthjs Email misdelivery Vulnerability. Affected: next-auth@<=4.24.14. Direct: true. Advisory: https://github.com/advisories/GHSA-5jpx-9hw9-2fx4 fixAvailable: true

**Fix:** Run `npm audit fix`.

### Minor · Quick — Vulnerable dependency: postcss (moderate)

`package.json:13`

PostCSS has XSS via Unescaped </style> in its CSS Stringify Output. Affected: postcss@<8.5.10. Direct: false. Advisory: https://github.com/advisories/GHSA-qx2v-qp2m-jg93 fixAvailable: {"name":"next","version":"15.5.18","isSemVerMajor":false}

**Fix:** Bump per advisory (may be breaking: next@15.5.18, semverMajor=false).

### Minor · Quick — Vulnerable dependency: tsx (moderate)

`package.json:15`

tsx vulnerable (via esbuild). Affected: tsx@3.13.0 - 4.19.2. Direct: true. fixAvailable: {"name":"tsx","version":"4.22.3","isSemVerMajor":false}

**Fix:** Bump per advisory (may be breaking: tsx@4.22.3, semverMajor=false).

### Minor · Quick — Vulnerable dependency: uuid (moderate)

`package.json:16`

uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided. Affected: uuid@<11.1.1. Direct: false. Advisory: https://github.com/advisories/GHSA-w5hq-g745-h8pq fixAvailable: true

**Fix:** Run `npm audit fix`.

### Minor · Quick — Vulnerable dependency: ws (moderate)

`package.json:18`

ws: Uninitialized memory disclosure. Affected: ws@8.0.0 - 8.20.0. Direct: false. Advisory: https://github.com/advisories/GHSA-58qx-3vcg-4xpx fixAvailable: true

**Fix:** Run `npm audit fix`.

### Minor · Quick — Vulnerable dependency: yaml (moderate)

`package.json:19`

yaml is vulnerable to Stack Overflow via deeply nested YAML collections. Affected: yaml@1.0.0 - 1.10.2. Direct: false. Advisory: https://github.com/advisories/GHSA-48c2-rrv3-qjmp fixAvailable: true

**Fix:** Run `npm audit fix`.

### Nit · Quick — Vulnerable dependency: @eslint/plugin-kit (low)

`package.json:1`

@eslint/plugin-kit is vulnerable to Regular Expression Denial of Service attacks through ConfigCommentParser. Affected: @eslint/plugin-kit@<0.3.4. Direct: false. Advisory: https://github.com/advisories/GHSA-xffm-g5w8-qvg7 fixAvailable: true

**Fix:** Run `npm audit fix`.
