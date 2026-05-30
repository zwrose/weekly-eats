// src/components/recipes/RecipeRow.tsx
'use client';

import { Box, ButtonBase } from '@mui/material';
import { tokens } from '@/lib/design-tokens';
import { Stars } from './Stars';
import { TagChip } from './TagChip';

export interface RecipeRowProps {
  recipe: { _id?: string; title: string; emoji?: string; updatedAt: string | Date };
  tags: string[];
  rating?: number;
  onOpen: () => void;
}

const MAX_MOBILE_TAGS = 3;
const MAX_DESKTOP_TAGS = 2;

/** Mobile card: emoji tile + title + stars + updated date + up-to-3 TagChips + chevron. */
export function RecipeCardMobile({ recipe, tags, rating, onOpen }: RecipeRowProps) {
  const updatedLabel = new Date(recipe.updatedAt).toLocaleDateString();
  const visibleTags = tags.slice(0, MAX_MOBILE_TAGS);

  return (
    <ButtonBase
      onClick={onOpen}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        width: '100%',
        textAlign: 'left',
        bgcolor: tokens.surface.raised,
        borderRadius: `${tokens.radius.lg}px`,
        border: `1px solid ${tokens.border.subtle}`,
        p: `${tokens.space.md}px`,
        mb: `${tokens.space.sm}px`,
        gap: `${tokens.space.md}px`,
        cursor: 'pointer',
      }}
    >
      {/* Emoji tile */}
      <Box
        sx={{
          width: 40,
          height: 40,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: tokens.surface.elevated,
          borderRadius: `${tokens.radius.lg}px`,
          fontSize: 20,
        }}
      >
        {recipe.emoji ?? '🍽️'}
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Title row */}
        <Box
          sx={{
            fontSize: 14,
            fontWeight: 600,
            color: tokens.text.primary,
            lineHeight: 1.3,
            mb: '4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {recipe.title}
        </Box>

        {/* Stars + updated */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            mb: '6px',
          }}
        >
          <Stars rating={rating} size={12} />
          <Box component="span" sx={{ fontSize: 11, color: tokens.text.muted }}>
            · updated {updatedLabel}
          </Box>
        </Box>

        {/* Tags */}
        {visibleTags.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {visibleTags.map((tag) => (
              <TagChip key={tag} small>
                {tag}
              </TagChip>
            ))}
          </Box>
        )}
      </Box>

      {/* Chevron */}
      <Box
        sx={{
          flexShrink: 0,
          alignSelf: 'center',
          fontSize: 14,
          color: tokens.text.muted,
        }}
      >
        ›
      </Box>
    </ButtonBase>
  );
}

/** Desktop grid row: emoji+title | tags (+N overflow) | stars | updated date. */
export function RecipeTableRow({ recipe, tags, rating, onOpen }: RecipeRowProps) {
  const updatedLabel = new Date(recipe.updatedAt).toLocaleDateString();
  const visibleTags = tags.slice(0, MAX_DESKTOP_TAGS);
  const overflow = tags.length - MAX_DESKTOP_TAGS;

  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      sx={{
        display: 'grid',
        gridTemplateColumns: '1fr 240px 100px 110px',
        alignItems: 'center',
        gap: `${tokens.space.md}px`,
        px: `${tokens.space.lg}px`,
        py: `${tokens.space.md}px`,
        borderBottom: `1px solid ${tokens.border.subtle}`,
        cursor: 'pointer',
        '&:hover': {
          bgcolor: tokens.surface.elevated,
        },
      }}
    >
      {/* Col 1: emoji + title */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: `${tokens.space.sm}px`, minWidth: 0 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: tokens.surface.elevated,
            borderRadius: `${tokens.radius.md}px`,
            fontSize: 16,
          }}
        >
          {recipe.emoji ?? '🍽️'}
        </Box>
        <Box
          sx={{
            fontSize: 14,
            fontWeight: 500,
            color: tokens.text.primary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {recipe.title}
        </Box>
      </Box>

      {/* Col 2: tags */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap' }}>
        {visibleTags.map((tag) => (
          <TagChip key={tag} small>
            {tag}
          </TagChip>
        ))}
        {overflow > 0 && (
          <Box component="span" sx={{ fontSize: 11, color: tokens.text.muted }}>
            +{overflow}
          </Box>
        )}
      </Box>

      {/* Col 3: stars */}
      <Box>
        <Stars rating={rating} size={12} />
      </Box>

      {/* Col 4: updated date */}
      <Box sx={{ fontSize: 12, color: tokens.text.secondary }}>{updatedLabel}</Box>
    </Box>
  );
}
