// src/components/recipes/SectionLabel.tsx
'use client';

import { Box } from '@mui/material';
import { tokens } from '@/lib/design-tokens';

export interface SectionLabelProps {
  /** Label text (rendered uppercase). */
  children: React.ReactNode;
  /** Optional right-aligned slot (e.g. a "+ Group" action), rendered in the accent color. */
  right?: React.ReactNode;
}

/**
 * Section header used across the recipe View and Edit surfaces: an uppercase label, a thin
 * horizontal rule that fills the remaining width, and an optional accent-colored right slot.
 * Matches the artboard `<SectionLabel>` (artboards-recipes.jsx).
 */
export function SectionLabel({ children, right }: SectionLabelProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, px: 0.5, pb: 1 }}>
      <Box
        component="span"
        sx={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: tokens.text.secondary,
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </Box>
      <Box sx={{ flex: 1, height: '1px', bgcolor: tokens.border.subtle }} />
      {right != null && (
        <Box
          component="span"
          sx={{ fontSize: 12, color: tokens.section.recipes, whiteSpace: 'nowrap' }}
        >
          {right}
        </Box>
      )}
    </Box>
  );
}
