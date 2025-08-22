import React from 'react';
import { DialogTitle as MuiDialogTitle, Box, IconButton } from '@mui/material';
import { Close } from '@mui/icons-material';

interface DialogTitleProps {
  children: React.ReactNode;
  onClose?: () => void;
  showCloseButton?: boolean;
  actions?: React.ReactNode; // Additional action buttons to show before the close button
}

export const DialogTitle: React.FC<DialogTitleProps> = ({ 
  children, 
  onClose, 
  showCloseButton = true,
  actions
}) => {
  return (
    <MuiDialogTitle>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ flex: 1 }}>
          {children}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {actions}
          {showCloseButton && onClose && (
            <IconButton 
              onClick={onClose} 
              color="inherit" 
              aria-label="Close"
            >
              <Close />
            </IconButton>
          )}
        </Box>
      </Box>
    </MuiDialogTitle>
  );
};
