'use client';

import React, { useState } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  IconButton,
  Drawer,
  Typography,
  Button,
  Divider,
} from '@mui/material';
import { FilterList, Close } from '@mui/icons-material';
import type { SelectChangeEvent } from '@mui/material';

export type SortOrder = 'asc' | 'desc';

interface RecipeFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  availableTags: string[];
  selectedRatings: number[];
  onRatingsChange: (ratings: number[]) => void;
  sortBy: string;
  sortOrder: SortOrder;
  onSortChange: (sortBy: string, sortOrder: SortOrder) => void;
}

const ratingOptions = [1, 2, 3, 4, 5];

const sortCombinedValues: Record<string, { sortBy: string; sortOrder: SortOrder }> = {
  'updatedAt-desc': { sortBy: 'updatedAt', sortOrder: 'desc' },
  'updatedAt-asc': { sortBy: 'updatedAt', sortOrder: 'asc' },
  'title-asc': { sortBy: 'title', sortOrder: 'asc' },
  'title-desc': { sortBy: 'title', sortOrder: 'desc' },
  'rating-desc': { sortBy: 'rating', sortOrder: 'desc' },
};

const desktopContainerSx = {
  display: { xs: 'none', md: 'flex' },
  gap: 2,
  mb: 3,
  flexWrap: 'wrap',
  alignItems: 'center',
} as const;

const mobileContainerSx = {
  display: { xs: 'flex', md: 'none' },
  gap: 1,
  mb: 2,
  alignItems: 'center',
} as const;

const filterDrawerSx = {
  '& .MuiDrawer-paper': {
    width: '85%',
    maxWidth: 360,
    p: 3,
  },
} as const;

const RecipeFilterBar = React.memo<RecipeFilterBarProps>(({
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
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleTagsChange = (e: SelectChangeEvent<string[]>) => {
    const value = e.target.value;
    onTagsChange(typeof value === 'string' ? value.split(',') : value);
  };

  const handleDeleteTag = (tagToDelete: string) => {
    onTagsChange(selectedTags.filter(t => t !== tagToDelete));
  };

  const toggleRating = (rating: number) => {
    if (selectedRatings.includes(rating)) {
      onRatingsChange(selectedRatings.filter(r => r !== rating));
    } else {
      onRatingsChange([...selectedRatings, rating].sort());
    }
  };

  const handleSortChange = (e: SelectChangeEvent) => {
    const combo = sortCombinedValues[e.target.value];
    if (combo) {
      onSortChange(combo.sortBy, combo.sortOrder);
    }
  };

  const currentSortValue = `${sortBy}-${sortOrder}`;
  const activeFilterCount = selectedTags.length + selectedRatings.length;

  // Shared filter controls used in both desktop and mobile drawer
  const filterControls = (
    <>
      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel id="tags-label">Tags</InputLabel>
        <Select
          labelId="tags-label"
          label="Tags"
          multiple
          value={selectedTags}
          onChange={handleTagsChange}
          input={<OutlinedInput label="Tags" />}
          renderValue={(selected) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {selected.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  onDelete={() => handleDeleteTag(tag)}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              ))}
            </Box>
          )}
        >
          {availableTags.map((tag) => (
            <MenuItem key={tag} value={tag}>
              {tag}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Rating
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {ratingOptions.map((r) => (
            <Chip
              key={r}
              label={`${'★'.repeat(r)}`}
              size="small"
              color={selectedRatings.includes(r) ? 'primary' : 'default'}
              variant={selectedRatings.includes(r) ? 'filled' : 'outlined'}
              onClick={() => toggleRating(r)}
              onDelete={selectedRatings.includes(r) ? () => toggleRating(r) : undefined}
            />
          ))}
        </Box>
      </Box>
    </>
  );

  return (
    <>
      {/* Desktop layout */}
      <Box sx={desktopContainerSx}>
        <TextField
          sx={{ flex: '1 1 200px', minWidth: 200 }}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search recipes..."
          size="small"
          autoComplete="off"
        />

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="tags-label-desktop">Tags</InputLabel>
          <Select
            labelId="tags-label-desktop"
            label="Tags"
            multiple
            value={selectedTags}
            onChange={handleTagsChange}
            input={<OutlinedInput label="Tags" />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    onDelete={() => handleDeleteTag(tag)}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                ))}
              </Box>
            )}
          >
            {availableTags.map((tag) => (
              <MenuItem key={tag} value={tag}>
                {tag}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5, whiteSpace: 'nowrap' }}>
            Rating:
          </Typography>
          {ratingOptions.map((r) => (
            <Chip
              key={r}
              label={`${'★'.repeat(r)}`}
              size="small"
              color={selectedRatings.includes(r) ? 'primary' : 'default'}
              variant={selectedRatings.includes(r) ? 'filled' : 'outlined'}
              onClick={() => toggleRating(r)}
              onDelete={selectedRatings.includes(r) ? () => toggleRating(r) : undefined}
            />
          ))}
        </Box>
      </Box>

      {/* Mobile layout: search + filter button */}
      <Box sx={mobileContainerSx}>
        <TextField
          sx={{ flex: 1 }}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search recipes..."
          size="small"
          autoComplete="off"
        />
        <IconButton
          onClick={() => setDrawerOpen(true)}
          color={activeFilterCount > 0 ? 'primary' : 'default'}
          aria-label="Open filters"
        >
          <FilterList />
        </IconButton>
      </Box>

      {/* Mobile filter drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={filterDrawerSx}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Filters</Typography>
          <IconButton onClick={() => setDrawerOpen(false)} aria-label="Close filters">
            <Close />
          </IconButton>
        </Box>
        <Divider sx={{ mb: 2 }} />

        {filterControls}

        <Divider sx={{ mb: 2 }} />
        <FormControl size="small" fullWidth sx={{ mb: 2 }}>
          <InputLabel id="sort-label-mobile">Sort By</InputLabel>
          <Select
            labelId="sort-label-mobile"
            label="Sort By"
            value={currentSortValue}
            onChange={handleSortChange}
          >
            <MenuItem value="updatedAt-desc">Newest First</MenuItem>
            <MenuItem value="updatedAt-asc">Oldest First</MenuItem>
            <MenuItem value="title-asc">Title A-Z</MenuItem>
            <MenuItem value="title-desc">Title Z-A</MenuItem>
            <MenuItem value="rating-desc">Highest Rated</MenuItem>
          </Select>
        </FormControl>

        <Button
          variant="contained"
          fullWidth
          onClick={() => setDrawerOpen(false)}
        >
          Apply Filters
        </Button>
      </Drawer>
    </>
  );
});

RecipeFilterBar.displayName = 'RecipeFilterBar';
export default RecipeFilterBar;
