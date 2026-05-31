// src/components/meal-plans/MealEditorDialog.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Box, Button, FormControlLabel, InputBase, IconButton } from '@mui/material';
import { Icon } from '@/components/ui/Icon';
import { PillSwitch } from '@/components/ui';
import { tokens } from '@/lib/design-tokens';
import type { MealItem } from '@/types/meal-plan';
import type { FoodItem } from '@/lib/hooks/use-food-item-selector';
import { EditorItemRow } from './EditorItemRow';
import { EditorGroupSection } from './EditorGroupSection';
import { CombinedSearch } from './CombinedSearch';
import { QtyEditor } from './QtyEditor';
import { UnitEditor } from './UnitEditor';
import { ConfirmDialog } from '@/components/ui';
import { mealItemCount } from './meal-display-utils';

export interface EditableMeal {
  items: MealItem[];
  skipped: boolean;
  skipReason: string;
}

export interface MealEditorDialogProps {
  open: boolean;
  title: string;
  subtitle?: string;
  meal: EditableMeal;
  isStaples?: boolean;
  onSave: (next: EditableMeal) => void;
  onClose: () => void;
  onFoodItemAdded: (item: FoodItem) => Promise<void>;
}

interface ChipTarget {
  groupIdx: number | null;
  ingIdx: number;
}

const clone = (m: EditableMeal): EditableMeal => JSON.parse(JSON.stringify(m));

export function MealEditorDialog({
  open,
  title,
  subtitle,
  meal,
  isStaples,
  onSave,
  onClose,
  onFoodItemAdded,
}: MealEditorDialogProps) {
  const [draft, setDraft] = useState<EditableMeal>(clone(meal));
  const [initial, setInitial] = useState<EditableMeal>(clone(meal));
  const [searchTarget, setSearchTarget] = useState<number | null>(null);
  const pendingTargetRef = useRef<number | null>(null);
  // Mirror searchTarget into a ref so setDraft updaters read the committed value.
  const searchTargetRef = useRef<number | null>(null);
  searchTargetRef.current = searchTarget;
  const [qtyState, setQtyState] = useState<{
    anchor: HTMLElement | null;
    target: ChipTarget;
  } | null>(null);
  const [unitState, setUnitState] = useState<{
    anchor: HTMLElement | null;
    target: ChipTarget;
  } | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [removeGroupIdx, setRemoveGroupIdx] = useState<number | null>(null);
  const [skipClearOpen, setSkipClearOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(clone(meal));
      setInitial(clone(meal));
      setSearchTarget(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  // ---- validation ----
  const invalidTopIdxs = draft.items.reduce<number[]>((acc, it, i) => {
    if (it.type !== 'ingredientGroup' && !it.id) acc.push(i);
    return acc;
  }, []);
  const invalidGroupTitleIdxs = draft.items.reduce<number[]>((acc, it, i) => {
    if (it.type === 'ingredientGroup' && !(it.name || it.ingredients?.[0]?.title)) acc.push(i);
    return acc;
  }, []);
  const groupInvalidIngredients = (groupIdx: number): number[] => {
    const g = draft.items[groupIdx];
    const ings = g?.ingredients?.[0]?.ingredients ?? [];
    return ings.reduce<number[]>((acc, ing, i) => {
      if (!ing.id) acc.push(i);
      return acc;
    }, []);
  };
  const anyGroupIngredientInvalid = draft.items.some(
    (it, i) => it.type === 'ingredientGroup' && groupInvalidIngredients(i).length > 0
  );
  const isValid =
    invalidTopIdxs.length === 0 && invalidGroupTitleIdxs.length === 0 && !anyGroupIngredientInvalid;

  // ---- mutations ----
  const setItems = (items: MealItem[]) => setDraft((d) => ({ ...d, items }));

  const addLooseFood = (item: FoodItem) => {
    const next: MealItem = {
      type: 'foodItem',
      id: item._id,
      name: item.singularName || item.name,
      quantity: 1,
      unit: item.unit || 'cup',
    };
    routeAdd(next);
  };
  const addLooseRecipe = (r: { _id: string; title: string; emoji?: string }) => {
    routeAdd({ type: 'recipe', id: r._id, name: r.title, quantity: 1 });
  };
  // Route an add into the search-target group, or loose. `next` is a foodItem/recipe
  // MealItem; its {type,id,name,quantity,unit} fields are also a valid RecipeIngredient,
  // so the same object works whether pushed loose or into a group's ingredients[].
  const routeAdd = (next: MealItem) => {
    // Read the target from the ref (kept in sync below), NOT the closure, so it
    // reflects the committed value inside the updater (same guard as addGroup).
    const target = searchTargetRef.current;
    setDraft((d) => {
      if (target != null && d.items[target]?.type === 'ingredientGroup') {
        const items = d.items.map((it, i) => {
          if (i !== target) return it;
          const grp = it.ingredients?.[0] ?? { title: it.name, ingredients: [] };
          return {
            ...it,
            ingredients: [
              {
                ...grp,
                ingredients: [
                  ...grp.ingredients,
                  {
                    type: next.type === 'recipe' ? ('recipe' as const) : ('foodItem' as const),
                    id: next.id,
                    name: next.name,
                    quantity: next.quantity ?? 1,
                    unit: next.unit,
                  },
                ],
              },
            ],
          };
        });
        return { ...d, items };
      }
      return { ...d, items: [...d.items, next] };
    });
  };
  const addGroup = (groupTitle: string) => {
    // Compute the new group's index INSIDE the updater (d.items is the committed
    // state; the enclosing `draft` closure can be stale under React 19 batching).
    setDraft((d) => {
      pendingTargetRef.current = d.items.length; // index the new group will occupy
      const items: MealItem[] = [
        ...d.items,
        {
          type: 'ingredientGroup' as const,
          id: '',
          name: groupTitle,
          ingredients: [{ title: groupTitle, ingredients: [] }],
        },
      ];
      return { ...d, items };
    });
  };
  // Apply the staged search-target after the append commits. Intentionally runs
  // every render (no dep array) and guards on the ref, so it only sets state when
  // an add-group has staged a target — no infinite loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (pendingTargetRef.current != null) {
      setSearchTarget(pendingTargetRef.current);
      pendingTargetRef.current = null;
    }
  });
  const removeLoose = (idx: number) => setItems(draft.items.filter((_, i) => i !== idx));
  const removeIngredient = (groupIdx: number, ingIdx: number) =>
    setItems(
      draft.items.map((it, i) => {
        if (i !== groupIdx || it.type !== 'ingredientGroup') return it;
        const grp = it.ingredients![0];
        return {
          ...it,
          ingredients: [{ ...grp, ingredients: grp.ingredients.filter((_, j) => j !== ingIdx) }],
        };
      })
    );
  const setGroupTitle = (groupIdx: number, t: string) =>
    setItems(
      draft.items.map((it, i) =>
        i === groupIdx && it.type === 'ingredientGroup'
          ? { ...it, name: t, ingredients: [{ ...it.ingredients![0], title: t }] }
          : it
      )
    );

  const writeQty = (target: ChipTarget, qty: number) =>
    setItems(
      draft.items.map((it, i) => {
        if (target.groupIdx == null) return i === target.ingIdx ? { ...it, quantity: qty } : it;
        if (i !== target.groupIdx || it.type !== 'ingredientGroup') return it;
        const grp = it.ingredients![0];
        return {
          ...it,
          ingredients: [
            {
              ...grp,
              ingredients: grp.ingredients.map((ing, j) =>
                j === target.ingIdx ? { ...ing, quantity: qty } : ing
              ),
            },
          ],
        };
      })
    );
  const writeUnit = (target: ChipTarget, unit: string) =>
    setItems(
      draft.items.map((it, i) => {
        if (target.groupIdx == null) return i === target.ingIdx ? { ...it, unit } : it;
        if (i !== target.groupIdx || it.type !== 'ingredientGroup') return it;
        const grp = it.ingredients![0];
        return {
          ...it,
          ingredients: [
            {
              ...grp,
              ingredients: grp.ingredients.map((ing, j) =>
                j === target.ingIdx ? { ...ing, unit } : ing
              ),
            },
          ],
        };
      })
    );

  // ---- skip ----
  const onToggleSkip = (next: boolean) => {
    if (next && draft.items.length > 0) {
      setSkipClearOpen(true);
      return;
    }
    setDraft((d) => ({ ...d, skipped: next }));
  };

  // ---- cancel ----
  const handleCancel = () => {
    if (dirty) setDiscardOpen(true);
    else onClose();
  };

  // qty/unit current value helpers — callers only read quantity/unit, which exist
  // on both MealItem (loose) and RecipeIngredient (in-group), so a structural
  // return type avoids casting across the two shapes.
  const targetItem = (t: ChipTarget): { quantity?: number; unit?: string } | undefined =>
    t.groupIdx == null
      ? draft.items[t.ingIdx]
      : draft.items[t.groupIdx]?.ingredients?.[0]?.ingredients[t.ingIdx];

  const excludeIds = useMemo(() => {
    const ids: string[] = [];
    draft.items.forEach((it) => {
      if (it.type === 'ingredientGroup')
        it.ingredients?.[0]?.ingredients.forEach((ing) => ing.id && ids.push(ing.id));
      else if (it.id) ids.push(it.id);
    });
    return ids;
  }, [draft.items]);

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      fullScreen={false}
      maxWidth="md"
      fullWidth
      // Mobile: a tall bottom sheet (anchored bottom, rounded top, drag handle, sheet shadow)
      // rather than a square full-screen takeover. Desktop: a centered modal.
      sx={{
        '& .MuiDialog-container': { alignItems: { xs: 'flex-end', md: 'center' } },
        '& .MuiDialog-paper': {
          bgcolor: tokens.surface.sheet,
          // Every responsive prop sets an explicit md value — MUI breakpoints are min-width, so a
          // bare { xs } leaks up to desktop. md restores the centered, gutter'd modal sizing.
          margin: { xs: 0, md: 'auto' },
          width: { xs: '100%', md: 'calc(100% - 64px)' },
          maxWidth: { xs: '100%', md: '900px' },
          height: { xs: '92%', md: 'auto' },
          maxHeight: { xs: '92%', md: '90vh' },
          borderTopLeftRadius: { xs: `${tokens.radius.sheet}px`, md: `${tokens.radius.xxxl}px` },
          borderTopRightRadius: { xs: `${tokens.radius.sheet}px`, md: `${tokens.radius.xxxl}px` },
          borderBottomLeftRadius: { xs: 0, md: `${tokens.radius.xxxl}px` },
          borderBottomRightRadius: { xs: 0, md: `${tokens.radius.xxxl}px` },
          boxShadow: { xs: tokens.shadow.sheet, md: tokens.shadow.modal },
        },
      }}
    >
      {/* Drag handle (mobile sheet) */}
      <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'center', pt: 1, pb: 0.5 }}>
        <Box
          sx={{ width: 36, height: 4, borderRadius: '2px', bgcolor: 'rgba(255,255,255,0.18)' }}
        />
      </Box>

      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.75,
          py: 2,
          borderBottom: `1px solid ${tokens.border.subtle}`,
        }}
      >
        <Button
          onClick={handleCancel}
          sx={{ color: tokens.section.plans, minWidth: 60, justifyContent: 'flex-start' }}
        >
          Cancel
        </Button>
        <Box sx={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
          <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>
            {title}
          </Box>
          {subtitle && (
            <Box sx={{ fontSize: 12, color: tokens.text.secondary }}>
              {subtitle} · {mealItemCount(draft.items)} items
            </Box>
          )}
        </Box>
        <Button
          onClick={() => onSave(draft)}
          disabled={!isValid}
          sx={{
            minWidth: 60,
            justifyContent: 'flex-end',
            fontWeight: 600,
            color: tokens.section.plans,
            '&.Mui-disabled': { color: tokens.text.muted },
          }}
        >
          Done
        </Button>
      </Box>

      {/* Skip bar */}
      {!isStaples && (
        <Box sx={{ px: 2.75, py: 1.5, borderBottom: `1px solid ${tokens.border.subtle}` }}>
          <FormControlLabel
            control={
              <PillSwitch
                checked={draft.skipped}
                onChange={(e) => onToggleSkip(e.target.checked)}
              />
            }
            label="Skip this meal"
            // The compact pill has no internal padding, so add the gap explicitly and drop
            // FormControlLabel's default negative margin that offset the old switch padding.
            sx={{ gap: 1.25, ml: 0 }}
            slotProps={{ typography: { sx: { fontSize: 13 } } }}
          />
          {draft.skipped && (
            <InputBase
              value={draft.skipReason}
              onChange={(e) => setDraft((d) => ({ ...d, skipReason: e.target.value }))}
              placeholder="Reason (optional) — e.g. out for work lunch"
              sx={{
                mt: 1,
                width: '100%',
                px: 1.5,
                py: 1.25,
                bgcolor: 'transparent',
                border: `1px solid ${tokens.border.subtle}`,
                borderRadius: `${tokens.radius.lg}px`,
                fontSize: 14,
                color: tokens.text.primary,
                '& input::placeholder': { color: tokens.text.muted, opacity: 1 },
              }}
            />
          )}
        </Box>
      )}

      {/* Body */}
      <Box
        // Clicking away from a targeted group (anywhere in the body that isn't inside a
        // group — groups stopPropagation) clears the search target.
        onClick={() => searchTarget != null && setSearchTarget(null)}
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 2.75,
          py: 2,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {draft.skipped ? (
          <Box
            sx={{
              py: 5,
              textAlign: 'center',
              color: tokens.text.secondary,
              fontSize: 13,
              fontStyle: 'italic',
            }}
          >
            This meal is skipped. Toggle off above to plan it.
          </Box>
        ) : draft.items.length === 0 ? (
          <Box sx={{ py: 5, textAlign: 'center' }}>
            <Box sx={{ fontSize: 14, color: tokens.text.secondary, mb: 0.5 }}>
              No items planned yet
            </Box>
            <Box sx={{ fontSize: 12, color: tokens.text.muted }}>Add from the search below</Box>
          </Box>
        ) : (
          <>
            <Box
              sx={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.14em',
                color: tokens.text.secondary,
                textTransform: 'uppercase',
                mb: 0.5,
              }}
            >
              Items
            </Box>
            {draft.items.map((it, i) =>
              it.type === 'ingredientGroup' ? (
                <EditorGroupSection
                  key={i}
                  group={it}
                  titleInvalid={invalidGroupTitleIdxs.includes(i)}
                  isTarget={searchTarget === i}
                  onAddToGroup={() => setSearchTarget(i)}
                  onTitleChange={(t) => setGroupTitle(i, t)}
                  onRemoveGroup={() => setRemoveGroupIdx(i)}
                  invalidIngredientIndexes={groupInvalidIngredients(i)}
                  onRemoveIngredient={(j) => removeIngredient(i, j)}
                  onQtyClick={(j, anchor) =>
                    setQtyState({ anchor, target: { groupIdx: i, ingIdx: j } })
                  }
                  onUnitClick={(j, anchor) =>
                    setUnitState({ anchor, target: { groupIdx: i, ingIdx: j } })
                  }
                />
              ) : (
                <EditorItemRow
                  key={i}
                  item={it}
                  invalid={invalidTopIdxs.includes(i)}
                  onRemove={() => removeLoose(i)}
                  onQtyClick={(anchor) =>
                    setQtyState({ anchor, target: { groupIdx: null, ingIdx: i } })
                  }
                  onUnitClick={(anchor) =>
                    setUnitState({ anchor, target: { groupIdx: null, ingIdx: i } })
                  }
                />
              )
            )}
          </>
        )}
        <Box sx={{ flex: 1 }} />
      </Box>

      {/* Sticky search */}
      {!draft.skipped && (
        <Box sx={{ px: 2.75 }}>
          {searchTarget != null && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: 0.5,
                fontSize: 12,
                color: tokens.text.secondary,
              }}
            >
              Adding to:{' '}
              {draft.items[searchTarget]?.name ||
                draft.items[searchTarget]?.ingredients?.[0]?.title}
              <IconButton
                size="small"
                aria-label="Stop adding to group"
                onClick={() => setSearchTarget(null)}
              >
                <Icon name="close" size={16} />
              </IconButton>
            </Box>
          )}
          <CombinedSearch
            excludeIds={excludeIds}
            onAddFood={addLooseFood}
            onAddRecipe={addLooseRecipe}
            onAddGroup={addGroup}
            onFoodItemAdded={onFoodItemAdded}
          />
        </Box>
      )}

      {/* Overlays */}
      <QtyEditor
        open={Boolean(qtyState)}
        anchorEl={qtyState?.anchor ?? null}
        value={qtyState ? (targetItem(qtyState.target)?.quantity ?? 1) : 1}
        onCommit={(n) => qtyState && writeQty(qtyState.target, n)}
        onClose={() => setQtyState(null)}
      />
      <UnitEditor
        open={Boolean(unitState)}
        anchorEl={unitState?.anchor ?? null}
        value={unitState ? (targetItem(unitState.target)?.unit ?? 'cup') : 'cup'}
        quantity={unitState ? (targetItem(unitState.target)?.quantity ?? 1) : 1}
        onCommit={(u) => unitState && writeUnit(unitState.target, u)}
        onClose={() => setUnitState(null)}
      />

      {/* Confirms */}
      <ConfirmDialog
        open={discardOpen}
        title="Discard changes?"
        body={`You've made changes to ${title}. They won't be saved.`}
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setDiscardOpen(false);
          onClose();
        }}
        onCancel={() => setDiscardOpen(false)}
      />
      <ConfirmDialog
        open={removeGroupIdx != null}
        title="Remove group?"
        body={
          removeGroupIdx != null
            ? `"${draft.items[removeGroupIdx]?.name || draft.items[removeGroupIdx]?.ingredients?.[0]?.title}" and its ${draft.items[removeGroupIdx]?.ingredients?.[0]?.ingredients.length ?? 0} items will be removed.`
            : ''
        }
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (removeGroupIdx != null) removeLoose(removeGroupIdx);
          setRemoveGroupIdx(null);
          setSearchTarget(null);
        }}
        onCancel={() => setRemoveGroupIdx(null)}
      />
      <ConfirmDialog
        open={skipClearOpen}
        title="Skip this meal?"
        body={`Skip will clear ${mealItemCount(draft.items)} item${mealItemCount(draft.items) === 1 ? '' : 's'} from ${title}.`}
        confirmLabel="Skip anyway"
        cancelLabel="Keep items"
        onConfirm={() => {
          setDraft((d) => ({ ...d, skipped: true, items: [] }));
          setSkipClearOpen(false);
        }}
        onCancel={() => setSkipClearOpen(false)}
      />
    </Dialog>
  );
}
