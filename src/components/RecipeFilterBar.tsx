'use client';

import React from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  Rating,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';

export type AccessLevelFilter = 'all' | 'personal' | 'shared-by-you' | 'global';
export type SortOrder = 'asc' | 'desc';

interface RecipeFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  accessLevel: AccessLevelFilter;
  onAccessLevelChange: (value: AccessLevelFilter) => void;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  availableTags: string[];
  minRating: number | null;
  onMinRatingChange: (rating: number | null) => void;
  sortBy: string;
  sortOrder: SortOrder;
  onSortChange: (sortBy: string, sortOrder: SortOrder) => void;
}

const containerSx = {
  display: 'flex',
  flexDirection: { xs: 'column', md: 'row' },
  gap: 2,
  mb: 3,
  flexWrap: 'wrap',
  alignItems: { md: 'center' },
} as const;

const searchSx = {
  flex: { md: '1 1 200px' },
  minWidth: 200,
} as const;

const selectSx = {
  minWidth: 140,
} as const;

const sortCombinedValues: Record<string, { sortBy: string; sortOrder: SortOrder }> = {
  'updatedAt-desc': { sortBy: 'updatedAt', sortOrder: 'desc' },
  'updatedAt-asc': { sortBy: 'updatedAt', sortOrder: 'asc' },
  'title-asc': { sortBy: 'title', sortOrder: 'asc' },
  'title-desc': { sortBy: 'title', sortOrder: 'desc' },
  'rating-desc': { sortBy: 'rating', sortOrder: 'desc' },
};

const RecipeFilterBar = React.memo<RecipeFilterBarProps>(({
  searchTerm,
  onSearchChange,
  accessLevel,
  onAccessLevelChange,
  selectedTags,
  onTagsChange,
  availableTags,
  minRating,
  onMinRatingChange,
  sortBy,
  sortOrder,
  onSortChange,
}) => {
  const handleAccessLevelChange = (e: SelectChangeEvent) => {
    onAccessLevelChange(e.target.value as AccessLevelFilter);
  };

  const handleTagsChange = (e: SelectChangeEvent<string[]>) => {
    const value = e.target.value;
    onTagsChange(typeof value === 'string' ? value.split(',') : value);
  };

  const handleSortChange = (e: SelectChangeEvent) => {
    const combo = sortCombinedValues[e.target.value];
    if (combo) {
      onSortChange(combo.sortBy, combo.sortOrder);
    }
  };

  const currentSortValue = `${sortBy}-${sortOrder}`;

  return (
    <Box sx={containerSx}>
      <TextField
        sx={searchSx}
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search recipes..."
        size="small"
        autoComplete="off"
      />

      <FormControl size="small" sx={selectSx}>
        <InputLabel id="access-level-label">Access Level</InputLabel>
        <Select
          labelId="access-level-label"
          label="Access Level"
          value={accessLevel}
          onChange={handleAccessLevelChange}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="personal">Personal</MenuItem>
          <MenuItem value="shared-by-you">Shared by You</MenuItem>
          <MenuItem value="global">Global</MenuItem>
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 160 }}>
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
                <Chip key={tag} label={tag} size="small" />
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

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box component="label" sx={{ fontSize: '0.875rem', whiteSpace: 'nowrap', color: 'text.secondary' }}>
          Min Rating
        </Box>
        <Rating
          aria-label="Min Rating"
          value={minRating}
          onChange={(_, newValue) => onMinRatingChange(newValue)}
          size="small"
        />
      </Box>

      <FormControl size="small" sx={selectSx}>
        <InputLabel id="sort-label">Sort By</InputLabel>
        <Select
          labelId="sort-label"
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
    </Box>
  );
});

RecipeFilterBar.displayName = 'RecipeFilterBar';
export default RecipeFilterBar;
