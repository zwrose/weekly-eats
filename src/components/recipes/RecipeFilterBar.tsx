'use client';

import { useState } from 'react';
import { Box, InputBase, ButtonBase, Popover, MenuItem, MenuList } from '@mui/material';
import { tokens } from '@/lib/design-tokens';
import { RECIPE_ACCENT_MUTED } from './recipe-display-utils';

export interface RecipeFilterBarProps {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  availableTags: string[];
  selectedRatings: number[];
  onRatingsChange: (ratings: number[]) => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

const chipSx = (selected: boolean) => ({
  height: 30,
  px: 1.5,
  borderRadius: `${tokens.radius.pill}px`,
  fontSize: 12,
  fontWeight: 500,
  bgcolor: selected ? RECIPE_ACCENT_MUTED : 'transparent',
  border: `1px solid ${selected ? tokens.section.recipes : tokens.border.subtle}`,
  color: selected ? tokens.section.recipes : tokens.text.secondary,
});

export function RecipeFilterBar(props: RecipeFilterBarProps) {
  const {
    searchTerm,
    onSearchChange,
    selectedTags,
    onTagsChange,
    availableTags,
    selectedRatings,
    onRatingsChange,
    sortBy,
    sortOrder,
    onSortChange,
    hasActiveFilters,
    onClearFilters,
  } = props;
  const [tagAnchor, setTagAnchor] = useState<HTMLElement | null>(null);
  const [ratingAnchor, setRatingAnchor] = useState<HTMLElement | null>(null);
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);

  const toggleTag = (t: string) =>
    onTagsChange(
      selectedTags.includes(t) ? selectedTags.filter((x) => x !== t) : [...selectedTags, t]
    );
  const toggleRating = (n: number) =>
    onRatingsChange(
      selectedRatings.includes(n) ? selectedRatings.filter((x) => x !== n) : [...selectedRatings, n]
    );

  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: { xs: 'wrap', md: 'nowrap' } }}
    >
      <Box
        sx={{
          flex: 1,
          minWidth: 200,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          height: 38,
          px: 1.5,
          bgcolor: tokens.surface.elevated,
          border: `1px solid ${tokens.border.strong}`,
          borderRadius: `${tokens.radius.lg}px`,
        }}
      >
        <Box component="span" sx={{ color: tokens.text.secondary, fontSize: 14 }}>
          ⌕
        </Box>
        <InputBase
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search recipes, tags…"
          inputProps={{ 'aria-label': 'Search recipes' }}
          sx={{ flex: 1, fontSize: 13, color: tokens.text.primary }}
        />
      </Box>

      <ButtonBase
        onClick={(e) => setTagAnchor(e.currentTarget)}
        sx={chipSx(selectedTags.length > 0)}
      >
        {selectedTags.length ? `Tags · ${selectedTags.length}` : 'Tags'}
      </ButtonBase>
      <ButtonBase
        onClick={(e) => setRatingAnchor(e.currentTarget)}
        sx={chipSx(selectedRatings.length > 0)}
      >
        ★ {selectedRatings.length ? selectedRatings.slice().sort().join(',') : 'Rating'}
      </ButtonBase>
      <ButtonBase onClick={(e) => setSortAnchor(e.currentTarget)} sx={chipSx(false)}>
        Sort ▾
      </ButtonBase>
      {hasActiveFilters && (
        <ButtonBase
          onClick={onClearFilters}
          sx={{ fontSize: 12, color: tokens.section.recipes, px: 1 }}
        >
          Clear
        </ButtonBase>
      )}

      {/* Tags popover */}
      <Popover
        open={Boolean(tagAnchor)}
        anchorEl={tagAnchor}
        onClose={() => setTagAnchor(null)}
        slotProps={{
          paper: {
            sx: {
              bgcolor: tokens.surface.sheet,
              border: `1px solid ${tokens.border.subtle}`,
              p: 1.5,
              maxWidth: 360,
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {availableTags.map((t) => (
            <ButtonBase key={t} onClick={() => toggleTag(t)} sx={chipSx(selectedTags.includes(t))}>
              {t}
            </ButtonBase>
          ))}
        </Box>
      </Popover>

      {/* Rating popover */}
      <Popover
        open={Boolean(ratingAnchor)}
        anchorEl={ratingAnchor}
        onClose={() => setRatingAnchor(null)}
        slotProps={{
          paper: {
            sx: {
              bgcolor: tokens.surface.sheet,
              border: `1px solid ${tokens.border.subtle}`,
              p: 1.5,
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          {[5, 4, 3, 2, 1].map((n) => (
            <ButtonBase
              key={n}
              onClick={() => toggleRating(n)}
              sx={chipSx(selectedRatings.includes(n))}
            >
              {n}★
            </ButtonBase>
          ))}
        </Box>
      </Popover>

      {/* Sort menu */}
      <Popover
        open={Boolean(sortAnchor)}
        anchorEl={sortAnchor}
        onClose={() => setSortAnchor(null)}
        slotProps={{
          paper: {
            sx: { bgcolor: tokens.surface.sheet, border: `1px solid ${tokens.border.subtle}` },
          },
        }}
      >
        <MenuList>
          {[
            ['updatedAt', 'Updated'],
            ['title', 'Title'],
            ['rating', 'Rating'],
          ].map(([key, label]) => (
            <MenuItem
              key={key}
              onClick={() => {
                onSortChange(key, key === 'title' ? 'asc' : 'desc');
                setSortAnchor(null);
              }}
              sx={{ color: tokens.text.primary, fontSize: 13 }}
            >
              {label}
              {sortBy === key ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ''}
            </MenuItem>
          ))}
        </MenuList>
      </Popover>
    </Box>
  );
}
