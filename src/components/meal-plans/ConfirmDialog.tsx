'use client';

import { Dialog, DialogContent, DialogActions, Button, Box } from '@mui/material';
import { tokens } from '@/lib/design-tokens';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** MUI color of the confirm button. */
  confirmColor?: 'error' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmColor = 'error',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="xs"
      slotProps={{
        paper: {
          sx: {
            bgcolor: tokens.surface.sheet,
            borderRadius: `${tokens.radius.xxl}px`,
            border: `1px solid ${tokens.border.strong}`,
            p: 0.5,
          },
        },
      }}
    >
      <DialogContent sx={{ pb: 1 }}>
        <Box
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 700,
            color: tokens.text.primary,
          }}
        >
          {title}
        </Box>
        <Box sx={{ fontSize: 13, color: tokens.text.secondary, mt: 1, lineHeight: 1.55 }}>
          {body}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} sx={{ color: tokens.text.primary }}>
          {cancelLabel}
        </Button>
        <Button onClick={onConfirm} variant="contained" color={confirmColor}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
