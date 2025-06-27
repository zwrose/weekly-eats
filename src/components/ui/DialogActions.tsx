import { Box, BoxProps } from '@mui/material';
import { ReactNode } from 'react';

interface DialogActionsProps extends Omit<BoxProps, 'children'> {
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
}

/**
 * Reusable dialog actions component that provides consistent responsive button layout
 * across all dialogs in the application.
 * 
 * @param children - Button components to render
 * @param align - Alignment of buttons on desktop (default: 'right')
 * @param props - Additional Box props
 */
export const DialogActions = ({ 
  children, 
  align = 'right', 
  ...props 
}: DialogActionsProps) => {
  const justifyContent = align === 'left' ? 'flex-start' : 
                        align === 'center' ? 'center' : 'flex-end';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: { xs: 1, sm: 0 },
        mt: 3,
        pt: 2,
        px: 2,
        pb: 2,
        justifyContent: { xs: 'stretch', sm: justifyContent }
      }}
      {...props}
    >
      {children}
    </Box>
  );
}; 