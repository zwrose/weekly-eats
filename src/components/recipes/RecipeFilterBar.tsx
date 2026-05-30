'use client';

import { memo, useState } from 'react';
import {
  Box,
  InputBase,
  ButtonBase,
  Drawer,
  Popover,
  MenuItem,
  MenuList,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { tokens } from '@/lib/design-tokens';
import { RECIPE_ACCENT_MUTED } from './recipe-display-utils';

/** Small uppercase section label used inside the tags picker. */
const PickerLabel = ({ children }: { children: React.ReactNode }) => (
  <Box
    sx={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: tokens.text.secondary,
      mb: 1,
    }}
  >
    {children}
  </Box>
);

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

/** Default sort direction per key when first selected */
const DEFAULT_SORT_ORDER: Record<string, 'asc' | 'desc'> = {
  updatedAt: 'desc',
  title: 'asc',
  rating: 'desc',
};

/** Display labels for the sort chip / menu. */
const SORT_LABELS: Record<string, string> = {
  updatedAt: 'Updated',
  title: 'Title',
  rating: 'Rating',
};

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

export const RecipeFilterBar = memo(function RecipeFilterBar(props: RecipeFilterBarProps) {
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
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [tagAnchor, setTagAnchor] = useState<HTMLElement | null>(null);
  const [tagSheetOpen, setTagSheetOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState('');
  const [ratingAnchor, setRatingAnchor] = useState<HTMLElement | null>(null);
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);

  const toggleTag = (t: string) =>
    onTagsChange(
      selectedTags.includes(t) ? selectedTags.filter((x) => x !== t) : [...selectedTags, t]
    );
  const openTags = (e: React.MouseEvent<HTMLElement>) => {
    if (isDesktop) setTagAnchor(e.currentTarget);
    else setTagSheetOpen(true);
  };
  const closeTags = () => {
    setTagAnchor(null);
    setTagSheetOpen(false);
  };

  // Selectable tag chip with a leading ✓ when active.
  const tagChip = (t: string) => {
    const isSelected = selectedTags.includes(t);
    return (
      <ButtonBase
        key={t}
        onClick={() => toggleTag(t)}
        sx={{ ...chipSx(isSelected), gap: 0.5, display: 'inline-flex', alignItems: 'center' }}
      >
        {isSelected && <Box component="span">✓</Box>}
        {t}
      </ButtonBase>
    );
  };

  // Shared body for the tags picker (search + Selected + All).
  const selectedAvailable = availableTags.filter((t) => selectedTags.includes(t));
  const restTags = availableTags
    .filter((t) => !selectedTags.includes(t))
    .filter((t) => t.toLowerCase().includes(tagQuery.trim().toLowerCase()));
  const tagsBody = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box
        sx={{
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
          value={tagQuery}
          onChange={(e) => setTagQuery(e.target.value)}
          placeholder="Search tags…"
          inputProps={{ 'aria-label': 'Search tags' }}
          sx={{ flex: 1, fontSize: 13, color: tokens.text.primary }}
        />
      </Box>
      {selectedAvailable.length > 0 && (
        <Box>
          <PickerLabel>Selected · {selectedAvailable.length}</PickerLabel>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {selectedAvailable.map(tagChip)}
          </Box>
        </Box>
      )}
      <Box>
        <PickerLabel>All tags</PickerLabel>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>{restTags.map(tagChip)}</Box>
      </Box>
    </Box>
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

      <ButtonBase onClick={openTags} sx={chipSx(selectedTags.length > 0)}>
        {selectedTags.length ? `Tags · ${selectedTags.length}` : 'Tags'}
      </ButtonBase>
      <ButtonBase
        onClick={(e) => setRatingAnchor(e.currentTarget)}
        sx={chipSx(selectedRatings.length > 0)}
      >
        ★{' '}
        {selectedRatings.length
          ? selectedRatings
              .slice()
              .sort((a, b) => a - b)
              .join(',')
          : 'Rating'}
      </ButtonBase>
      <ButtonBase onClick={(e) => setSortAnchor(e.currentTarget)} sx={chipSx(false)}>
        {`Sort: ${SORT_LABELS[sortBy] ?? 'Updated'} ▾`}
      </ButtonBase>
      {hasActiveFilters && (
        <ButtonBase
          onClick={onClearFilters}
          sx={{ fontSize: 12, color: tokens.section.recipes, px: 1 }}
        >
          Clear
        </ButtonBase>
      )}

      {/* Tags picker — popover on desktop */}
      <Popover
        open={Boolean(tagAnchor)}
        anchorEl={tagAnchor}
        onClose={closeTags}
        slotProps={{
          paper: {
            sx: {
              bgcolor: tokens.surface.sheet,
              border: `1px solid ${tokens.border.subtle}`,
              borderRadius: `${tokens.radius.xl}px`,
              p: 1.5,
              width: 360,
            },
          },
        }}
      >
        {tagsBody}
      </Popover>

      {/* Tags picker — bottom sheet on mobile */}
      <Drawer
        anchor="bottom"
        open={tagSheetOpen}
        onClose={closeTags}
        slotProps={{
          paper: {
            sx: {
              bgcolor: tokens.surface.sheet,
              borderTopLeftRadius: `${tokens.radius.sheet}px`,
              borderTopRightRadius: `${tokens.radius.sheet}px`,
              maxHeight: '85%',
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1, pb: 0.5 }}>
          <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: tokens.border.strong }} />
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.25,
            borderBottom: `1px solid ${tokens.border.subtle}`,
          }}
        >
          <ButtonBase
            onClick={() => onTagsChange([])}
            sx={{
              minWidth: 56,
              justifyContent: 'flex-start',
              color: tokens.text.secondary,
              fontSize: 14,
            }}
          >
            Reset
          </ButtonBase>
          <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>
            Filter by tags
          </Box>
          <ButtonBase
            onClick={closeTags}
            sx={{
              minWidth: 56,
              justifyContent: 'flex-end',
              color: tokens.section.recipes,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Done
          </ButtonBase>
        </Box>
        <Box sx={{ p: 2, overflowY: 'auto' }}>{tagsBody}</Box>
      </Drawer>

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
                // If already-active key: flip direction. Otherwise: use default direction.
                const nextOrder: 'asc' | 'desc' =
                  sortBy === key
                    ? sortOrder === 'asc'
                      ? 'desc'
                      : 'asc'
                    : (DEFAULT_SORT_ORDER[key] ?? 'desc');
                onSortChange(key, nextOrder);
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
});
