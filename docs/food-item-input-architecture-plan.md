# Food Item Input Architecture Migration Plan

## Current State Analysis

### Existing Implementations

1. **IngredientInput** - Used in recipes, meal plans (via MealEditor)

   - Supports food items + recipes
   - Has quantity + unit inputs
   - Custom search implementation with debouncing
   - Can accept `propFoodItems` or load internally

2. **BaseIngredientInput** - Similar to IngredientInput but always loads data internally

   - Nearly identical code (duplication issue)

3. **Shopping Lists** - Custom Autocomplete implementation

   - Food items only
   - Has quantity + unit inputs
   - Uses MUI Autocomplete (not custom search)

4. **Pantry** - Custom Autocomplete implementation
   - Food items only
   - No quantity/unit (just selection)

### Common Behaviors (Must Be Consistent)

- ✅ Food item selection with autocomplete/search
- ✅ Food item creation via Enter key or button click
- ✅ Dialog prefill with typed text
- ✅ Quantity input: allows empty/0, shows error when <= 0, validation
- ✅ Unit selection: singular/plural forms update in real-time based on quantity
- ✅ Recipe selection (where applicable)
- ✅ Exclude already-selected items from options

---

## Architecture Options Analysis

### Option A: Single Monolithic Component

**Structure:**

```tsx
<FoodItemSelector
  allowRecipes={true}
  allowQuantity={true}
  allowUnit={true}
  value={ingredient}
  onChange={handleChange}
  excludeIds={selectedIds}
  // ... many more props
/>
```

**Pros:**

- ✅ Simple API - one component to learn
- ✅ Guaranteed consistency - all behavior in one place
- ✅ Easy to use - just import and configure
- ✅ Single source of truth for all logic
- ✅ Easier to maintain - one file to update

**Cons:**

- ❌ Large component file (500+ lines)
- ❌ Many props (15-20+) - complex API surface
- ❌ Harder to customize - must support all use cases
- ❌ Harder to test - need to test all prop combinations
- ❌ Performance - always includes all features (even unused)
- ❌ Type complexity - many conditional types based on props

**Verdict:** ❌ Not recommended - too rigid, hard to maintain

---

### Option B: Composable Hooks + Small Components

**Structure:**

```tsx
// Core hook
const {
  inputValue,
  options,
  selectedItem,
  handleSelect,
  handleCreate
} = useFoodItemSelector({
  allowRecipes: true,
  excludeIds: selectedIds
});

// Composable components
<FoodItemAutocomplete {...selectorProps} />
<QuantityInput value={qty} onChange={setQty} />
<UnitSelector value={unit} quantity={qty} />
```

**Pros:**

- ✅ Highly flexible - compose exactly what you need
- ✅ Testable in isolation - test hooks separately from UI
- ✅ Reusable logic - hooks can be used in different contexts
- ✅ Easy to customize - swap components as needed
- ✅ Better performance - only include what you use
- ✅ Clear separation of concerns - logic vs presentation
- ✅ Easier to extend - add new hooks/components without touching existing code

**Cons:**

- ❌ More files to maintain (hooks + components)
- ❌ More complex API - need to understand composition
- ❌ Potential for inconsistency - developers might compose incorrectly
- ❌ More imports - need to import multiple pieces
- ❌ Learning curve - need to understand hook patterns

**Verdict:** ✅ **RECOMMENDED** - Best balance of flexibility and maintainability

---

### Option C: Hybrid (Core Hook + Flexible Wrappers)

**Structure:**

```tsx
// Core hook (same as Option B)
const selector = useFoodItemSelector({...});

// Pre-built wrappers for common cases
<IngredientInput {...selector} /> // Full: food + recipes + quantity + unit
<FoodItemSelector {...selector} /> // Simple: food items only
<ShoppingListItemInput {...selector} /> // Shopping: food + quantity + unit
```

**Pros:**

- ✅ Best of both worlds - flexibility + convenience
- ✅ Common cases are easy - use pre-built wrappers
- ✅ Custom cases possible - use hooks directly
- ✅ Consistent core logic - all wrappers use same hook
- ✅ Progressive complexity - start simple, customize as needed
- ✅ Easier migration - can migrate one wrapper at a time

**Cons:**

- ❌ More code to maintain (hooks + multiple wrappers)
- ❌ Need to decide: wrapper or direct hook usage?
- ❌ Wrapper components might become "magic" - hide complexity
- ❌ Still need to understand hooks for customization

**Verdict:** ✅ **STRONGLY RECOMMENDED** - Best practical solution

---

## Recommended Architecture: Option C (Hybrid)

### Core Structure

```
src/lib/hooks/
  ├── use-food-item-selector.ts      # Core selection logic
  ├── use-food-item-creator.ts       # Creation flow logic
  └── use-quantity-input.ts          # Quantity validation logic

src/components/food-item-inputs/
  ├── FoodItemAutocomplete.tsx       # Autocomplete UI (reusable)
  ├── QuantityInput.tsx               # Quantity field (reusable)
  ├── UnitSelector.tsx                # Unit selector (reusable)
  ├── IngredientInput.tsx            # Wrapper: recipes + quantity + unit
  ├── FoodItemSelector.tsx           # Wrapper: food items only
  └── ShoppingListItemInput.tsx      # Wrapper: food + quantity + unit
```

### Core Hook: `useFoodItemSelector`

```typescript
interface UseFoodItemSelectorOptions {
  allowRecipes?: boolean;
  excludeIds?: string[];
  foodItems?: FoodItem[];
  recipes?: Recipe[];
  currentRecipeId?: string;
  onFoodItemAdded?: (item: FoodItem) => Promise<void>;
}

interface UseFoodItemSelectorReturn {
  // State
  inputValue: string;
  options: SearchOption[];
  selectedItem: SearchOption | null;
  isLoading: boolean;

  // Actions
  setInputValue: (value: string) => void;
  handleSelect: (item: SearchOption | null) => void;
  handleCreate: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;

  // Dialog state
  isCreateDialogOpen: boolean;
  prefillName: string;
}
```

### Benefits of This Approach

1. **Consistent Core Logic** - All selection behavior in one hook
2. **Testable** - Test hooks independently, mock in component tests
3. **Flexible** - Use hooks directly or use convenient wrappers
4. **Maintainable** - Fix bugs once, all usages benefit
5. **Type-Safe** - Strong TypeScript types throughout

---

## Migration Plan

### Phase 1: Test Current Behavior (Week 1)

**Goal:** Capture existing working behavior as tests

#### 1.1 Unit Tests for Core Behaviors

- [ ] `use-food-item-selector.test.ts` - Test selection logic
- [ ] `use-food-item-creator.test.ts` - Test creation flow
- [ ] `use-quantity-input.test.ts` - Test quantity validation
- [ ] `FoodItemAutocomplete.test.tsx` - Test autocomplete UI
- [ ] `QuantityInput.test.tsx` - Test quantity input UI
- [ ] `UnitSelector.test.tsx` - Test unit selector UI

#### 1.2 Integration Tests for Each Usage

- [ ] `IngredientInput.integration.test.tsx` - Recipes page
- [ ] `IngredientInput.integration.test.tsx` - Meal plans page
- [ ] `ShoppingListItemInput.integration.test.tsx` - Shopping lists
- [ ] `FoodItemSelector.integration.test.tsx` - Pantry page

#### 1.3 Test Coverage Requirements

- ✅ Food item selection (typing, filtering, selecting)
- ✅ Recipe selection (if applicable)
- ✅ Enter key to create food item
- ✅ Button click to create food item
- ✅ Dialog prefill with typed text
- ✅ Quantity validation (empty, 0, negative, positive)
- ✅ Unit singular/plural updates
- ✅ Exclude already-selected items
- ✅ Auto-focus behavior
- ✅ Error states and messages

**Deliverable:** All existing behavior documented as passing tests

---

### Phase 2: Extract Core Hooks (Week 2)

**Goal:** Create reusable hooks with same behavior

#### 2.1 Create Core Hooks

- [ ] `use-food-item-selector.ts` - Extract selection logic from IngredientInput
- [ ] `use-food-item-creator.ts` - Extract creation flow
- [ ] `use-quantity-input.ts` - Extract quantity logic

#### 2.2 Create Reusable UI Components

- [ ] `FoodItemAutocomplete.tsx` - Extract autocomplete UI
- [ ] `QuantityInput.tsx` - Extract quantity field
- [ ] `UnitSelector.tsx` - Extract unit selector

#### 2.3 Refactor IngredientInput to Use Hooks

- [ ] Replace internal logic with hooks
- [ ] Ensure all tests still pass
- [ ] Verify behavior matches exactly

**Deliverable:** Hooks extracted, IngredientInput refactored, all tests pass

---

### Phase 3: Create Wrapper Components (Week 2-3)

**Goal:** Create convenient wrappers for each use case

#### 3.1 Create Wrappers

- [ ] `IngredientInput.tsx` - Full wrapper (recipes + quantity + unit)
- [ ] `FoodItemSelector.tsx` - Simple wrapper (food items only)
- [ ] `ShoppingListItemInput.tsx` - Shopping list wrapper

#### 3.2 Write Tests for Wrappers

- [ ] Test each wrapper in isolation
- [ ] Test wrapper + hook integration
- [ ] Ensure API matches expected usage

**Deliverable:** Wrapper components created and tested

---

### Phase 4: Migrate All Usages (Week 3)

**Goal:** Replace all custom implementations with centralized components

#### 4.1 Migrate Shopping Lists

- [ ] Replace custom Autocomplete with `ShoppingListItemInput`
- [ ] Update tests
- [ ] Verify behavior matches

#### 4.2 Migrate Pantry

- [ ] Replace custom Autocomplete with `FoodItemSelector`
- [ ] Update tests
- [ ] Verify behavior matches

#### 4.3 Migrate Recipes

- [ ] Ensure using new `IngredientInput` (should already be done)
- [ ] Update any remaining custom code
- [ ] Verify tests pass

#### 4.4 Migrate Meal Plans

- [ ] Ensure `MealEditor` uses new `IngredientInput`
- [ ] Update any remaining custom code
- [ ] Verify tests pass

**Deliverable:** All pages migrated, all tests pass, no custom implementations remain

---

### Phase 5: Cleanup & Documentation (Week 3-4)

**Goal:** Remove old code, document new architecture

#### 5.1 Remove Old Code

- [ ] Delete `BaseIngredientInput.tsx` (replaced by hooks)
- [ ] Remove any duplicate logic
- [ ] Clean up unused imports

#### 5.2 Documentation

- [ ] Write architecture docs
- [ ] Write usage examples for each wrapper
- [ ] Write guide for creating custom compositions
- [ ] Update component storybook (if applicable)

#### 5.3 Final Verification

- [ ] Run full test suite
- [ ] Manual testing of all pages
- [ ] Performance check
- [ ] Code review

**Deliverable:** Clean codebase, comprehensive documentation

---

## Testing Strategy

### Unit Tests (Hooks)

```typescript
describe("useFoodItemSelector", () => {
  it("filters options based on input", () => {});
  it("excludes selected IDs from options", () => {});
  it("handles Enter key to create when no options", () => {});
  it("prefills dialog with input value", () => {});
  // ... more tests
});
```

### Component Tests (UI)

```typescript
describe("FoodItemAutocomplete", () => {
  it("renders autocomplete with options", () => {});
  it("shows create button when no options", () => {});
  it("calls onSelect when item selected", () => {});
  // ... more tests
});
```

### Integration Tests (Full Flow)

```typescript
describe("IngredientInput Integration", () => {
  it("allows selecting food item and setting quantity", () => {});
  it("allows creating new food item via Enter", () => {});
  it("updates unit singular/plural based on quantity", () => {});
  // ... more tests
});
```

---

## Success Criteria

✅ All existing behavior preserved (tests prove it)
✅ All usages migrated to centralized components
✅ No duplicate code for food item selection/creation
✅ Consistent behavior across all pages
✅ Comprehensive test coverage (>90%)
✅ Clear documentation for developers
✅ Performance maintained or improved

---

## Risk Mitigation

### Risk: Breaking Changes

**Mitigation:** Comprehensive test suite catches regressions

### Risk: Migration Complexity

**Mitigation:** Incremental migration, test at each step

### Risk: Performance Issues

**Mitigation:** Profile before/after, optimize hooks if needed

### Risk: Developer Adoption

**Mitigation:** Clear documentation, examples, code review

---

## Timeline Estimate

- **Week 1:** Phase 1 (Tests) - 40 hours
- **Week 2:** Phase 2-3 (Hooks + Wrappers) - 40 hours
- **Week 3:** Phase 4 (Migration) - 40 hours
- **Week 4:** Phase 5 (Cleanup) - 20 hours

**Total:** ~140 hours (3.5 weeks for 1 developer)

---

## Next Steps

1. Review and approve this plan
2. Create GitHub issues for each phase
3. Set up test infrastructure if needed
4. Begin Phase 1: Writing tests for current behavior
