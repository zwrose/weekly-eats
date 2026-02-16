# Decisions: Store Purchase History

## ADR-001: Manual Verification Only for User-Facing Phases

**Date:** 2026-02-16
**Status:** Accepted

**Context:** The Conductor workflow includes a "User Manual Verification" task at the end of every phase. However, many phases (data layer, API routes, client utilities, isolated components) have no user-facing changes that can be practically verified in a browser.

**Decision:** Only include manual verification tasks for phases where the user can perform straightforward validation in the browser. For this track, only Phase 5 (UI Integration) includes a manual verification task.

**Consequences:** Reduces unnecessary verification overhead. Automated tests remain the primary validation for non-UI phases.

## ADR-002: Server-Side Finish Shop

**Date:** 2026-02-16
**Status:** Accepted

**Context:** The current "Finish Shop" flow operates client-side: it filters out checked items and sends the updated list to the server. Adding history recording requires atomically saving checked items to history AND removing them from the list.

**Decision:** Create a new `POST /api/shopping-lists/[storeId]/finish-shop` endpoint that handles both operations server-side in a single request. The client calls this instead of directly updating the shopping list.

**Consequences:** Ensures history is always recorded when items are cleared. Simplifies the client logic. Adds one new API route.

## ADR-003: Upsert Strategy for History Records

**Date:** 2026-02-16
**Status:** Accepted

**Context:** The same food item may be purchased at the same store across multiple shopping trips. We need to decide whether to keep one record per item (updated each time) or multiple records (one per trip).

**Decision:** Use upsert (one record per store + food item). On each "Finish Shop", update the existing record with the latest quantity, unit, and date. This keeps the history collection small and the query simple.

**Consequences:** We lose per-trip granularity (e.g., "bought milk 5 times in January") but gain simplicity and performance. The "last purchased" date is sufficient for the sorting/display requirements.
