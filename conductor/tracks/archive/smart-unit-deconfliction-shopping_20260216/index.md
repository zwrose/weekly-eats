# Track: Smart Unit Deconfliction for Shopping List Meal Plan Population

- **Track ID:** smart-unit-deconfliction-shopping_20260216
- **Type:** feature
- **Branch:** feature/smart-unit-deconfliction
- **Status:** planned
- **Created:** 2026-02-16

## Description

Add intelligent unit conversion to the shopping list meal plan population workflow. When the same food item appears across recipes with different but convertible units (e.g., cups and pints), the system auto-converts and pre-fills the conflict resolution dialog. The pre-merge step is wired into the production flow to guarantee at most one deconfliction prompt per food item.

## Files

- [spec.md](./spec.md) — Specification
- [plan.md](./plan.md) — Implementation plan
- [decisions.md](./decisions.md) — Architecture decisions
- [metadata.json](./metadata.json) — Track metadata
