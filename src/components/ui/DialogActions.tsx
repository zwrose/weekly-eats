'use client';

import React from 'react';
import { DialogActions as MuiDialogActions, Box, SxProps, Theme } from '@mui/material';

interface DialogActionsProps {
  children: React.ReactNode;
  primaryButtonIndex?: number; // Index of the primary button (0-based)
  sx?: SxProps<Theme>;
}

export const DialogActions: React.FC<DialogActionsProps> = ({
  children,
  primaryButtonIndex = 0,
  sx,
}) => {
  const childrenArray = React.Children.toArray(children);

  return (
    <MuiDialogActions sx={{ px: 3, pb: 2.5, pt: 1, ...(sx as object) }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1.5, sm: 1 },
          justifyContent: { sm: 'flex-end' },
          width: '100%',
        }}
      >
        {childrenArray.map((child, index) => (
          <Box
            key={index}
            sx={{
              width: { xs: '100%', sm: 'auto' },
              '& > *': { width: { xs: '100%', sm: 'auto' } },
              // On mobile, reorder so primary button comes first
              order: {
                xs: index === primaryButtonIndex ? -1 : index,
                sm: 0,
              },
            }}
          >
            {child}
          </Box>
        ))}
      </Box>
    </MuiDialogActions>
  );
};
