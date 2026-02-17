# Decisions: View Recipe Details from Meal Plan UI

## ADR-001: View-Only Recipe Dialog from Meal Plan

**Date:** 2026-02-16
**Status:** Accepted

**Context:** The user wants to view recipe details from the meal plan UI. RecipeViewDialog supports both view and edit modes, but wiring edit mode requires ~15 props and duplicating 100+ lines of state management from the recipes page.

**Decision:** Open RecipeViewDialog in read-only mode from the meal plan. Provide an "Edit in Recipes" link that navigates to the recipes page for full editing.

**Rationale:** View-only integration is dramatically simpler (fetch recipe + pass read-only props vs. duplicating the entire edit state machine). The edit-in-recipes link preserves full editing capability without the complexity cost.
