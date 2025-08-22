import React from 'react';
import { DialogActions as MuiDialogActions, Box } from '@mui/material';

interface DialogActionsProps {
  children: React.ReactNode;
  primaryButtonIndex?: number; // Index of the primary button (0-based)
}

export const DialogActions: React.FC<DialogActionsProps> = ({ 
  children, 
  primaryButtonIndex = 0 
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
    <MuiDialogActions>
      <Box sx={{ 
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: { xs: 1, sm: 0 },
        justifyContent: { xs: 'stretch', sm: 'flex-end' },
        width: '100%'
      }}>
        {reorderedChildren.map((child, index) => (
          <Box
            key={index}
            sx={{
              width: { xs: '100%', sm: 'auto' },
              '& > *': {
                width: { xs: '100%', sm: 'auto' }
              }
            }}
          >
            {child}
          </Box>
        ))}
      </Box>
    </MuiDialogActions>
  );
}; 