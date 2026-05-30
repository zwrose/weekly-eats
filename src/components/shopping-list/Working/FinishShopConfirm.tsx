'use client';

import { Box, Button, Dialog, DialogActions, DialogContent, Drawer } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';

export interface FinishShopConfirmProps {
  open: boolean;
  variant: 'dialog' | 'sheet';
  storeName: string;
  boughtCount: number;
  remainingCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmContent({
  storeName,
  boughtCount,
  remainingCount,
  onConfirm,
  onCancel,
}: Omit<FinishShopConfirmProps, 'open' | 'variant'>) {
  const theme = useTheme();

  return (
    <>
      {/* Icon badge */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            bgcolor: alpha(theme.palette.primary.main, 0.14),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="done_all" size={28} sx={{ color: theme.palette.primary.main }} />
        </Box>
      </Box>

      {/* Title */}
      <Box
        sx={{
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          fontWeight: 700,
          color: tokens.text.primary,
          textAlign: 'center',
          mb: 1.5,
        }}
      >
        Finish this shop?
      </Box>

      {/* Body */}
      <Box
        sx={{
          fontSize: 14,
          color: tokens.text.secondary,
          lineHeight: 1.6,
          textAlign: 'center',
          mb: 3,
        }}
      >
        {boughtCount} {boughtCount === 1 ? 'item' : 'items'} in cart will be saved to {storeName}{' '}
        purchase history and cleared from the list.{' '}
        {remainingCount > 0
          ? `${remainingCount} ${remainingCount === 1 ? 'item' : 'items'} remain.`
          : ''}
      </Box>

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Button
          onClick={onCancel}
          fullWidth
          sx={{
            color: tokens.text.primary,
            border: `1px solid ${tokens.border.strong}`,
            borderRadius: `${tokens.radius.xl}px`,
            height: 44,
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          fullWidth
          sx={{
            bgcolor: theme.palette.primary.main,
            color: tokens.onAccent.shop,
            borderRadius: `${tokens.radius.xl}px`,
            height: 44,
            fontWeight: 600,
            '&:hover': { bgcolor: theme.palette.primary.main, opacity: 0.9 },
          }}
        >
          Save trip
        </Button>
      </Box>
    </>
  );
}

export function FinishShopConfirm({
  open,
  variant,
  storeName,
  boughtCount,
  remainingCount,
  onConfirm,
  onCancel,
}: FinishShopConfirmProps) {
  const contentProps = { storeName, boughtCount, remainingCount, onConfirm, onCancel };

  if (variant === 'dialog') {
    return (
      <Dialog
        open={open}
        onClose={onCancel}
        slotProps={{
          paper: {
            sx: {
              width: 460,
              maxWidth: '100%',
              bgcolor: tokens.surface.sheet,
              borderRadius: `${tokens.radius.xxxl}px`,
              border: `1px solid ${tokens.border.strong}`,
              boxShadow: tokens.shadow.modal,
              p: 0,
            },
          },
        }}
      >
        <DialogContent sx={{ p: 3 }}>
          <ConfirmContent {...contentProps} />
        </DialogContent>
        {/* Empty DialogActions prevents MUI from injecting extra padding */}
        <DialogActions sx={{ p: 0 }} />
      </Dialog>
    );
  }

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onCancel}
      slotProps={{
        paper: {
          sx: {
            bgcolor: tokens.surface.sheet,
            borderTopLeftRadius: `${tokens.radius.sheet}px`,
            borderTopRightRadius: `${tokens.radius.sheet}px`,
            border: `1px solid ${tokens.border.strong}`,
            borderBottom: 'none',
            boxShadow: tokens.shadow.sheet,
            p: 0,
          },
        },
      }}
    >
      {/* Grab handle */}
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, pb: 0.5 }}>
        <Box
          sx={{
            width: 36,
            height: 4,
            borderRadius: 2,
            bgcolor: tokens.border.strong,
          }}
        />
      </Box>

      <Box sx={{ p: 3, pt: 2 }}>
        <ConfirmContent {...contentProps} />
      </Box>
    </Drawer>
  );
}
