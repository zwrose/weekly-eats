# Decisions: Store Purchase History

## ADR-001: Server-Side Finish Shop

**Date:** 2026-02-16
**Status:** Accepted

**Context:** The current "Finish Shop" flow operates client-side: it filters out checked items and sends the updated list to the server. Adding history recording requires atomically saving checked items to history AND removing them from the list.

**Decision:** Create a new `POST /api/shopping-lists/[storeId]/finish-shop` endpoint that handles both operations server-side in a single request. The client calls this instead of directly updating the shopping list.

**Consequences:** Ensures history is always recorded when items are cleared. Simplifies the client logic. Adds one new API route.

## ADR-002: Upsert Strategy for History Records

**Date:** 2026-02-16
**Status:** Accepted

**Context:** The same food item may be purchased at the same store across multiple shopping trips. We need to decide whether to keep one record per item (updated each time) or multiple records (one per trip).

**Decision:** Use upsert (one record per store + food item). On each "Finish Shop", update the existing record with the latest quantity, unit, and date. This keeps the history collection small and the query simple.

**Consequences:** We lose per-trip granularity (e.g., "bought milk 5 times in January") but gain simplicity and performance. The "last purchased" date is sufficient for the sorting/display requirements.
