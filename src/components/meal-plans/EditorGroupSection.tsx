// src/components/meal-plans/EditorGroupSection.tsx
'use client';

import { Box, InputBase, IconButton } from '@mui/material';
import { Icon } from '@/components/ui/Icon';
import type { MealItem } from '@/types/meal-plan';
import { tokens } from '@/lib/design-tokens';
import { EditorItemRow } from './EditorItemRow';

export interface EditorGroupSectionProps {
  group: MealItem;
  titleInvalid?: boolean;
  onTitleChange: (title: string) => void;
  onRemoveGroup: () => void;
  onQtyClick: (ingredientIndex: number, anchor: HTMLElement) => void;
  onUnitClick: (ingredientIndex: number, anchor: HTMLElement) => void;
  onRemoveIngredient: (ingredientIndex: number) => void;
  invalidIngredientIndexes: number[];
}

export function EditorGroupSection({
  group,
  titleInvalid,
  onTitleChange,
  onRemoveGroup,
  onQtyClick,
  onUnitClick,
  onRemoveIngredient,
  invalidIngredientIndexes,
}: EditorGroupSectionProps) {
  const ings = group.ingredients?.[0]?.ingredients ?? [];
  const title = group.name ?? group.ingredients?.[0]?.title ?? '';

  return (
    <Box sx={{ mt: 1.75 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 0.5, mb: 0.5 }}>
        <Box
          component="span"
          sx={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.16em',
            color: tokens.text.secondary,
          }}
        >
          GROUP
        </Box>
        <InputBase
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Group title (required)"
          sx={{
            flex: 1,
            height: 30,
            px: 1.25,
            border: `1px solid ${titleInvalid ? tokens.state.warn : tokens.border.subtle}`,
            borderRadius: `${tokens.radius.md}px`,
            fontSize: 13,
            fontWeight: 600,
            color: tokens.text.primary,
            '& input::placeholder': { color: tokens.text.muted, opacity: 1 },
          }}
        />
        <IconButton
          aria-label="Remove group"
          onClick={onRemoveGroup}
          size="small"
          sx={{ color: tokens.text.muted }}
        >
          <Icon name="delete" size={18} />
        </IconButton>
      </Box>
      {titleInvalid && (
        <Box sx={{ fontSize: 11, color: tokens.state.warn, px: 0.5, pb: 0.5 }}>
          Group title is required
        </Box>
      )}
      <Box sx={{ borderTop: `1px solid ${tokens.border.subtle}` }}>
        {ings.length === 0 ? (
          <Box sx={{ py: 1.75, textAlign: 'center' }}>
            <Box sx={{ fontSize: 13, color: tokens.text.muted, mb: 0.75 }}>
              No items in this group
            </Box>
          </Box>
        ) : (
          ings.map((ing, i) => (
            <EditorItemRow
              key={i}
              item={{
                type: ing.type,
                id: ing.id,
                name: ing.name ?? '',
                quantity: ing.quantity,
                unit: ing.unit,
              }}
              invalid={invalidIngredientIndexes.includes(i)}
              onQtyClick={(anchor) => onQtyClick(i, anchor)}
              onUnitClick={(anchor) => onUnitClick(i, anchor)}
              onRemove={() => onRemoveIngredient(i)}
            />
          ))
        )}
      </Box>
    </Box>
  );
}
