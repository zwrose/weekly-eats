'use client';

import { Box, Typography, Button, Divider, FormControl, MenuItem, Select } from '@mui/material';
import { Public, Person } from '@mui/icons-material';
import dynamic from 'next/dynamic';

const RecipeTagsEditor = dynamic(() => import('@/components/RecipeTagsEditor'), { ssr: false });
const RecipeStarRating = dynamic(() => import('@/components/RecipeStarRating'), { ssr: false });

interface RecipeMetadataEditorProps {
  isGlobal: boolean;
  onIsGlobalChange: (isGlobal: boolean) => void;
  rating: number | undefined;
  onRatingChange: (rating: number | undefined) => void;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
}

export default function RecipeMetadataEditor({
  isGlobal,
  onIsGlobalChange,
  rating,
  onRatingChange,
  tags,
  onTagsChange,
}: RecipeMetadataEditorProps) {
  return (
    <>
      {/* Mobile: compact selects */}
      <Box sx={{ display: { xs: 'flex', sm: 'none' }, gap: 1, mb: 1.5 }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <Typography variant="h6" sx={{ mb: 0.5 }}>
            Access
          </Typography>
          <Select
            value={isGlobal ? 'global' : 'personal'}
            onChange={(e) => onIsGlobalChange(e.target.value === 'global')}
          >
            <MenuItem value="global">
              <Public sx={{ fontSize: 16, mr: 0.75, verticalAlign: 'text-bottom' }} />
              Global
            </MenuItem>
            <MenuItem value="personal">
              <Person sx={{ fontSize: 16, mr: 0.75, verticalAlign: 'text-bottom' }} />
              Personal
            </MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <Typography variant="h6" sx={{ mb: 0.5 }}>
            Rating
          </Typography>
          <Select
            value={rating ?? 0}
            onChange={(e) => {
              const val = Number(e.target.value);
              onRatingChange(val === 0 ? undefined : val);
            }}
            renderValue={(val) =>
              val === 0 ? (
                'None'
              ) : (
                <Box component="span" sx={{ color: 'warning.main' }}>
                  {'★'.repeat(val as number)}
                </Box>
              )
            }
          >
            <MenuItem value={0}>None</MenuItem>
            {[1, 2, 3, 4, 5].map((v) => (
              <MenuItem key={v} value={v}>
                <Box component="span" sx={{ color: 'warning.main' }}>
                  {'★'.repeat(v)}
                </Box>
                <Box component="span" sx={{ color: 'text.secondary', ml: 0.5 }}>
                  ({v}/5)
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <Box sx={{ display: { xs: 'block', sm: 'none' }, mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          Tags
        </Typography>
        <RecipeTagsEditor tags={tags} onChange={onTagsChange} editable={true} label="" />
      </Box>

      {/* Desktop: full controls in a row */}
      <Box
        sx={{
          display: { xs: 'none', sm: 'flex' },
          flexWrap: 'wrap',
          gap: 2,
          mb: 2,
          alignItems: 'flex-start',
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ mb: 0.5 }}>
            Access
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant={isGlobal ? 'contained' : 'outlined'}
              onClick={() => onIsGlobalChange(true)}
              startIcon={<Public />}
              size="small"
            >
              Global
            </Button>
            <Button
              variant={isGlobal ? 'outlined' : 'contained'}
              onClick={() => onIsGlobalChange(false)}
              startIcon={<Person />}
              size="small"
            >
              Personal
            </Button>
          </Box>
        </Box>
        <Divider orientation="vertical" flexItem />
        <Box>
          <RecipeStarRating rating={rating} onChange={onRatingChange} editable={true} />
        </Box>
        <Divider orientation="vertical" flexItem />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ mb: 0.5 }}>
            Tags
          </Typography>
          <RecipeTagsEditor tags={tags} onChange={onTagsChange} editable={true} label="" />
        </Box>
      </Box>
    </>
  );
}
