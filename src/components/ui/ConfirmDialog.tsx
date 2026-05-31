'use client';

import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Drawer,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const titleNode = (
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
  );
  const bodyNode = (
    <Box sx={{ fontSize: 13, color: tokens.text.secondary, mt: 1, lineHeight: 1.55 }}>{body}</Box>
  );

  // Mobile: bottom sheet (grab handle + full-width stacked buttons).
  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onCancel}
        slotProps={{
          paper: {
            sx: {
              bgcolor: tokens.surface.sheet,
              borderRadius: '18px 18px 0 0',
              boxShadow: '0 -10px 30px rgba(0,0,0,0.4)',
              p: '12px 20px 28px',
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', pb: '10px' }}>
          <Box
            sx={{ width: 36, height: 4, borderRadius: '2px', bgcolor: 'rgba(255,255,255,0.18)' }}
          />
        </Box>
        {titleNode}
        {bodyNode}
        <Box sx={{ display: 'flex', gap: 1, mt: 2.5 }}>
          <Button onClick={onCancel} sx={{ flex: 1, height: 44, color: tokens.text.primary }}>
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            variant="contained"
            color={confirmColor}
            sx={{ flex: 1, height: 44 }}
          >
            {confirmLabel}
          </Button>
        </Box>
      </Drawer>
    );
  }

  // Desktop: centered dialog (unchanged appearance).
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
        {titleNode}
        {bodyNode}
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
