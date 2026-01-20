"use client";

import { useState } from 'react';
import {
  Box,
  IconButton,
  Typography,
} from '@mui/material';
import {
  Star,
  StarBorder,
} from '@mui/icons-material';

interface RecipeStarRatingProps {
  rating?: number;
  sharedRatings?: Array<{ userId: string; userName?: string; userEmail: string; rating: number }>;
  onChange?: (rating: number | undefined) => void;
  editable?: boolean;
  label?: string;
}

export default function RecipeStarRating({
  rating,
  sharedRatings = [],
  onChange,
  editable = true,
  label = 'Rating',
}: RecipeStarRatingProps) {
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);

  const handleStarClick = (value: number) => {
    if (!editable || !onChange) return;
    // Clicking the same star again clears the rating
    if (rating === value) {
      onChange(undefined);
    } else {
      onChange(value);
    }
  };

  const handleStarHover = (value: number | null) => {
    if (!editable) return;
    setHoveredRating(value);
  };

  const displayRating = hoveredRating ?? rating ?? 0;

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        {label}
      </Typography>
      {editable && onChange ? (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {[1, 2, 3, 4, 5].map((value) => (
              <IconButton
                key={value}
                onClick={() => handleStarClick(value)}
                onMouseEnter={() => handleStarHover(value)}
                onMouseLeave={() => handleStarHover(null)}
                size="small"
                sx={{
                  padding: 0.5,
                  color: value <= displayRating ? 'warning.main' : 'action.disabled',
                  '&:hover': {
                    color: 'warning.main',
                  },
                }}
              >
                {value <= displayRating ? <Star /> : <StarBorder />}
              </IconButton>
            ))}
            {rating && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                ({rating}/5)
              </Typography>
            )}
          </Box>
          {sharedRatings.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Shared ratings:
              </Typography>
              {sharedRatings.map((shared) => (
                <Box key={shared.userId} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Star
                      key={value}
                      sx={{
                        color: value <= shared.rating ? 'secondary.main' : 'action.disabled',
                        fontSize: '1rem',
                      }}
                    />
                  ))}
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                    {shared.userName || shared.userEmail} ({shared.rating}/5)
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      ) : (
        <Box>
          {rating ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Star
                  key={value}
                  sx={{
                    color: value <= rating ? 'warning.main' : 'action.disabled',
                    fontSize: '1.2rem',
                  }}
                />
              ))}
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                ({rating}/5)
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No rating
            </Typography>
          )}
          {sharedRatings.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Shared ratings:
              </Typography>
              {sharedRatings.map((shared) => (
                <Box key={shared.userId} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Star
                      key={value}
                      sx={{
                        color: value <= shared.rating ? 'secondary.main' : 'action.disabled',
                        fontSize: '1rem',
                      }}
                    />
                  ))}
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                    {shared.userName || shared.userEmail} ({shared.rating}/5)
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

