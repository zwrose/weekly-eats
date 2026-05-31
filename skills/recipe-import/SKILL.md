---
name: recipe-import
description: Import a recipe from a URL or PDF into Weekly Eats. Parse the source, match each ingredient to the user's food-item catalog (creating new items as needed), confirm the mapping in chat, then save a properly structured recipe via the Weekly Eats connector.
---

# Recipe Import

Turn a recipe the user gives you (a URL, a PDF, or pasted text) into a saved Weekly
Eats recipe. Weekly Eats recipes are **strictly structured**: every ingredient must
reference a real food item from the user's catalog (with a unit) — there is no
free-text ingredient. Your job is to bridge messy real-world recipe text to that
structure, confirming with the user before saving.

## When to use

Use this skill when the user asks to import, save, or add a recipe from a source —
e.g. "import this recipe: <url>", "save this recipe PDF to Weekly Eats", or pastes
recipe text and asks to add it.

## Tools you will use

All are provided by the connected Weekly Eats MCP server:

- `food_items_search` — find existing food items by name (the user's catalog plus
  shared/global items). Use this to match ingredient lines.
- `food_items_create` — create a new **personal** food item: `{ name, singularName,
pluralName, unit }`. Use only for ingredients with no good catalog match.
- `recipes_create` — save the recipe once everything is resolved.
- `recipes_search` / `recipes_get` — optional, to check whether a similar recipe
  already exists before creating a duplicate.

## The flow

### 1. Read the source

Read the URL or PDF the user provided using your own native file/URL reading — this
skill does **not** fetch or parse files for you. Extract:

- **title** (required) and an optional single **emoji** that fits the dish
- the list of **ingredient lines** (raw text, e.g. "2 cups all-purpose flour, sifted")
- the **instructions** as prose

If the user pasted text directly, work from that.

Optionally, before doing the work, use `recipes_search` to check whether the user
already has this recipe, and skip or confirm if so.

### 2. Parse each ingredient line

For each line, separate it into **quantity**, **unit**, **ingredient name**, and
optional **prep note**. Examples:

- "2 cups all-purpose flour, sifted" → quantity `2`, unit `cup`, name `all-purpose
flour`, prep `sifted`
- "3 large eggs" → quantity `3`, unit `each` (count-based), name `egg`
- "1/2 tsp kosher salt" → quantity `0.5`, unit `teaspoon`, name `kosher salt`

Normalize units to a singular, common form (cup, tablespoon, teaspoon, gram, ounce,
pound, milliliter, each, …). Convert fractions to decimals for `quantity`.

### 3. Match each ingredient to the catalog

For each parsed ingredient, call `food_items_search` with the core ingredient name
(drop adjectives like "large", "fresh", "organic" for the search; keep them as a prep
note or in the name only if they matter). Pick the best match from the results.

Track three buckets:

- **Matched** — a confident catalog hit. Record its `_id` and the unit you'll use.
- **Ambiguous** — multiple plausible hits, or a weak match. Needs the user to pick.
- **New** — no reasonable match. Will need `food_items_create`.

### 4. Confirm in chat (REQUIRED — do not skip)

Before creating anything, present the full mapping to the user in a compact table:
each ingredient line → the matched (or proposed-new) food item, the quantity, and the
unit. Clearly mark which items you would **create new**. Ask them to confirm or
correct. Wait for their response.

This is the human-in-the-loop step. Never save a recipe without it.

### 5. Create the confirmed-new food items

For each item the user confirmed as new, call `food_items_create` with `{ name,
singularName, pluralName, unit }`. Use a sensible singular/plural (e.g. name
"tomato", singular "tomato", plural "tomatoes"). Capture the returned `_id`.

Items created via the connector are always personal to the user (never global) — that
is enforced server-side; you don't set it.

### 6. Assemble the recipe structure

Build `ingredients` as an array of ingredient lists. Use a single list for a simple
recipe; use multiple lists with `title`s when the source groups ingredients (e.g.
"For the sauce", "For the topping"). Each ingredient is:

    { "type": "foodItem", "id": "<foodItem _id>", "quantity": <number>, "unit": "<unit>", "prepInstructions": "<optional>" }

A list wraps ingredients and may carry an optional `title`. The full `ingredients`
value is an array of these lists, for example:

    [
      {
        "title": "For the sauce",
        "ingredients": [
          { "type": "foodItem", "id": "664...a1", "quantity": 2, "unit": "cup", "prepInstructions": "crushed" }
        ]
      },
      {
        "title": "For the topping",
        "ingredients": [
          { "type": "foodItem", "id": "664...b2", "quantity": 0.5, "unit": "cup" }
        ]
      }
    ]

For a simple recipe, use a single list (with no `title`).

Every `id` must be a real food item `_id` (matched or newly created). Never invent an
id and never emit a free-text ingredient.

Keep the source's instructions as the `instructions` string (lightly cleaned —
numbered steps or paragraphs are fine).

### 7. Save and link

Call `recipes_create` with `{ title, emoji?, instructions, ingredients }`. On success
it returns the created recipe (with its `_id`). Give the user a link to the recipe in
the app: `/recipes/<_id>`.

If `recipes_create` returns an error (it re-validates the structure), read the message,
fix the offending ingredient (usually a bad id or a missing unit), and retry — do not
silently drop ingredients.

## Guardrails

- **Confirm before writing.** Step 4 is mandatory. No surprise saves.
- **No free-text ingredients.** If you can't match or create a food item for a line,
  raise it with the user rather than dropping or faking it.
- **One emoji max**, and only if it genuinely fits; omit otherwise.
- **Don't create duplicate food items.** Prefer a catalog match; only create when
  there's truly no good fit.
