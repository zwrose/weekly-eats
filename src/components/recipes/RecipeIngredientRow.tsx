// src/components/recipes/RecipeIngredientRow.tsx
'use client';

import { useState } from 'react';
import { Box, ButtonBase, InputBase } from '@mui/material';
import { tokens } from '@/lib/design-tokens';
import { Icon } from '@/components/ui/Icon';
import { QtyEditor } from '@/components/meal-plans/QtyEditor';
import { UnitEditor } from '@/components/meal-plans/UnitEditor';
import { getUnitForm } from '@/lib/food-items-utils';
import type { RecipeIngredient } from '@/types/recipe';

export interface RecipeIngredientRowProps {
  ingredient: RecipeIngredient;
  onChange: (next: RecipeIngredient) => void;
  onRemove: () => void;
}

const ctrlBtn = {
  height: 30,
  px: 1.25,
  border: `1px solid ${tokens.border.strong}`,
  borderRadius: `${tokens.radius.sm}px`,
  color: tokens.text.primary,
  fontSize: 13,
  fontVariantNumeric: 'tabular-nums',
} as const;

export function RecipeIngredientRow({ ingredient, onChange, onRemove }: RecipeIngredientRowProps) {
  const [qtyAnchor, setQtyAnchor] = useState<HTMLElement | null>(null);
  const [unitAnchor, setUnitAnchor] = useState<HTMLElement | null>(null);
  const [prepOpen, setPrepOpen] = useState(Boolean(ingredient.prepInstructions));
  const isRecipe = ingredient.type === 'recipe';
  const name = ingredient.name ?? '';

  return (
    <Box sx={{ borderTop: `1px solid ${tokens.border.subtle}`, py: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            fontSize: 14,
            color: tokens.text.primary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </Box>
        <ButtonBase
          aria-label={`quantity for ${name}`}
          onClick={(e) => setQtyAnchor(e.currentTarget)}
          sx={{ ...ctrlBtn, fontWeight: 600 }}
        >
          {ingredient.quantity}
        </ButtonBase>
        {!isRecipe && (
          <ButtonBase
            aria-label={`unit for ${name}`}
            onClick={(e) => setUnitAnchor(e.currentTarget)}
            sx={{
              ...ctrlBtn,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              borderColor: tokens.border.subtle,
            }}
          >
            {ingredient.unit ? getUnitForm(ingredient.unit, ingredient.quantity) : 'unit'}
            <Box component="span" sx={{ fontSize: 9, color: tokens.text.muted }}>
              ▾
            </Box>
          </ButtonBase>
        )}
        <ButtonBase
          aria-label={`Remove ${name}`}
          onClick={onRemove}
          sx={{ color: tokens.text.muted, px: 0.5 }}
        >
          <Icon name="delete" size={16} />
        </ButtonBase>
      </Box>

      {prepOpen ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.75 }}>
          <Box
            sx={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: tokens.text.secondary,
            }}
          >
            Prep
          </Box>
          <InputBase
            value={ingredient.prepInstructions ?? ''}
            placeholder="e.g. sifted"
            inputProps={{ 'aria-label': `prep for ${name}` }}
            onChange={(e) => onChange({ ...ingredient, prepInstructions: e.target.value })}
            sx={{
              flex: 1,
              height: 28,
              px: 1.25,
              border: `1px solid ${tokens.border.subtle}`,
              borderRadius: `${tokens.radius.sm}px`,
              fontSize: 12,
              color: tokens.text.primary,
              fontStyle: 'italic',
            }}
          />
          <ButtonBase
            aria-label={`Remove prep for ${name}`}
            onClick={() => {
              setPrepOpen(false);
              onChange({ ...ingredient, prepInstructions: undefined });
            }}
            sx={{ color: tokens.text.muted, px: 0.5 }}
          >
            <Icon name="delete" size={15} />
          </ButtonBase>
        </Box>
      ) : (
        <ButtonBase
          onClick={() => setPrepOpen(true)}
          sx={{ mt: 0.5, color: tokens.text.secondary, fontSize: 11 }}
        >
          + prep instructions
        </ButtonBase>
      )}

      <QtyEditor
        open={Boolean(qtyAnchor)}
        anchorEl={qtyAnchor}
        value={ingredient.quantity}
        onCommit={(n: number) => onChange({ ...ingredient, quantity: n })}
        onClose={() => setQtyAnchor(null)}
      />
      {!isRecipe && (
        <UnitEditor
          open={Boolean(unitAnchor)}
          anchorEl={unitAnchor}
          value={ingredient.unit || ''}
          quantity={ingredient.quantity}
          onCommit={(u: string) => onChange({ ...ingredient, unit: u })}
          onClose={() => setUnitAnchor(null)}
        />
      )}
    </Box>
  );
}
