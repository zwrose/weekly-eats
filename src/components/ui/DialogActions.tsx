'use client';

import React from 'react';
import { DialogActions as MuiDialogActions, Box } from '@mui/material';

interface DialogActionsProps {
  children: React.ReactNode;
  primaryButtonIndex?: number; // Index of the primary button (0-based)
}

export const DialogActions: React.FC<DialogActionsProps> = ({
  children,
  primaryButtonIndex = 0,
}) => {
  const childrenArray = React.Children.toArray(children);

  // Reorder children so primary button comes first on mobile
  const reorderedChildren = React.useMemo(() => {
    if (childrenArray.length <= 1) return childrenArray;

    const primaryButton = childrenArray[primaryButtonIndex];
    const otherButtons = childrenArray.filter((_, index) => index !== primaryButtonIndex);

    return [primaryButton, ...otherButtons];
  }, [childrenArray, primaryButtonIndex]);

  return (
    <MuiDialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
      {/* Mobile: primary button first (column layout) */}
      <Box
        sx={{
          display: { xs: 'flex', sm: 'none' },
          flexDirection: 'column',
          gap: 1.5,
          width: '100%',
        }}
      >
        {reorderedChildren.map((child, index) => (
          <Box
            key={index}
            sx={{
              width: '100%',
              '& > *': { width: '100%' },
            }}
          >
            {child}
          </Box>
        ))}
      </Box>
      {/* Desktop: original order (Cancel left, action right) */}
      <Box
        sx={{
          display: { xs: 'none', sm: 'flex' },
          flexDirection: 'row',
          gap: 1,
          justifyContent: 'flex-end',
          width: '100%',
        }}
      >
        {childrenArray.map((child, index) => (
          <Box key={index} sx={{ width: 'auto', '& > *': { width: 'auto' } }}>
            {child}
          </Box>
        ))}
      </Box>
    </MuiDialogActions>
  );
};
