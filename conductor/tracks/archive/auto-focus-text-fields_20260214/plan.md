# Plan: Auto-focus text fields when they dynamically appear

## Phase 1: Dialog auto-focus fields

- [x] Task 1.1: Write failing tests for EmojiPicker dialog auto-focus (`EmojiPicker.tsx`)
- [x] Task 1.2: Implement `autoFocus` on EmojiPicker search TextField — verify tests pass [7275b2d]
- [x] Task 1.3: Write failing tests for Create Recipe dialog title auto-focus (`recipes/page.tsx`)
- [x] Task 1.5: Write failing tests for Share Store dialog email auto-focus (`shopping-lists/page.tsx`)
- [x] Task 1.7: Write failing tests for Share Meal Plans dialog email auto-focus (`meal-plans/page.tsx`)
- [x] Task 1.9: Write failing tests for Share Recipes dialog email auto-focus (`recipes/page.tsx`)
- [x] Task 1.4: Implement `autoFocus` on Create Recipe title TextField — verify tests pass
- [x] Task 1.6: Implement `autoFocus` on Share Store email TextField — verify tests pass
- [x] Task 1.8: Implement `autoFocus` on Share Meal Plans email TextField — verify tests pass
- [x] Task 1.10: Implement `autoFocus` on Share Recipes email TextField — verify tests pass
- [x] Task: Conductor - User Manual Verification 'Phase 1'

## Phase 2: Conditionally rendered / mode-toggle auto-focus fields

- [x] Task 2.1: Write failing tests for prep instructions auto-focus in IngredientInput
- [x] Task 2.2: Implement auto-focus on prep instructions TextField in `IngredientInput.tsx`
- [x] Task 2.3: Write failing tests for prep instructions auto-focus in BaseIngredientInput
- [x] Task 2.4: Implement auto-focus on prep instructions TextField in `BaseIngredientInput.tsx`
- [x] Task 2.5: Write failing tests for Edit Recipe title auto-focus on edit mode toggle
- [x] Task 2.6: Implement auto-focus on Edit Recipe title TextField (`recipes/page.tsx`)
- [x] Task 2.7: Write failing tests for skip reason auto-focus when checkbox is checked
- [x] Task 2.8: Implement auto-focus on skip reason TextField (`meal-plans/page.tsx`)
- [x] Task: Conductor - User Manual Verification 'Phase 2'

## Phase 3: Regression verification

- [x] Task 3.1: Run full test suite and verify no regressions to existing auto-focus behavior
- [x] Task 3.2: Verify code coverage meets >80% threshold for modified files
- [x] Task: Conductor - User Manual Verification 'Phase 3'
