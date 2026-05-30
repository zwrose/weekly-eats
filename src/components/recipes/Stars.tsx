// src/components/recipes/Stars.tsx
'use client';

import { useState } from 'react';
import { Box, ButtonBase } from '@mui/material';
import { tokens } from '@/lib/design-tokens';

export interface SharedRating {
  userId: string;
  userName?: string;
  userEmail: string;
  rating: number;
}

export interface StarsProps {
  rating?: number;
  editable?: boolean;
  onChange?: (rating: number) => void;
  size?: number;
  sharedRatings?: SharedRating[];
}

const STARS = [1, 2, 3, 4, 5];

export function Stars({
  rating = 0,
  editable = false,
  onChange,
  size = 13,
  sharedRatings,
}: StarsProps) {
  const [hover, setHover] = useState(0);
  const shown = editable && hover > 0 ? hover : rating;

  const glyph = (filled: boolean) => (
    <Box
      component="span"
      sx={{ color: tokens.state.warn, fontSize: size, opacity: filled ? 1 : 0.22, lineHeight: 1 }}
    >
      ★
    </Box>
  );

  if (!editable) {
    return (
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
        {STARS.map((n) => (
          <Box key={n} component="span">
            {glyph(n <= shown)}
          </Box>
        ))}
        {sharedRatings && sharedRatings.length > 0 && (
          <Box component="span" sx={{ fontSize: 11, color: tokens.text.secondary, ml: 1 }}>
            {sharedRatings.map((s) => `${s.userName ?? s.userEmail}: ${s.rating}`).join(', ')}
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
      {STARS.map((n) => (
        <ButtonBase
          key={n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange?.(n === rating ? 0 : n)}
          sx={{ borderRadius: '4px', p: '1px' }}
        >
          {glyph(n <= shown)}
        </ButtonBase>
      ))}
    </Box>
  );
}
