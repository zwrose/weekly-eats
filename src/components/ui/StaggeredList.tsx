'use client';

import React from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { getStaggeredAnimationSx } from '@/lib/animation-utils';

interface StaggeredListProps {
  children: React.ReactNode;
  component?: React.ElementType;
  sx?: SxProps<Theme>;
}

export const StaggeredList: React.FC<StaggeredListProps> = React.memo(
  function StaggeredList({ children, component = 'div', sx }) {
    return (
      <Box component={component} sx={sx}>
        {React.Children.map(children, (child, index) => {
          if (!React.isValidElement(child)) return child;

          return (
            <Box sx={getStaggeredAnimationSx(index)}>{child}</Box>
          );
        })}
      </Box>
    );
  },
);
