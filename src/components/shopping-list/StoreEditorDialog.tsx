'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Button, ButtonBase, Dialog, InputBase, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { tokens } from '@/lib/design-tokens';
import { EmojiPicker } from '@/components/ui/EmojiPicker';

export interface StoreEditorDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialName?: string;
  initialEmoji?: string;
  onSave: (data: { name: string; emoji?: string }) => void | Promise<void>;
  onClose: () => void;
}

const DEFAULT_EMOJI = '🏪';

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <Box
    sx={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: tokens.text.secondary,
      mb: 1,
    }}
  >
    {children}
  </Box>
);

/**
 * Create / edit a store: an emoji preview tile + name field, restyled to the
 * redesign's dark dialog vocabulary. Owns only local draft state — the page
 * keeps owning `createStore` / `updateStore` via `onSave`.
 */
export function StoreEditorDialog({
  open,
  mode,
  initialName = '',
  initialEmoji = DEFAULT_EMOJI,
  onSave,
  onClose,
}: StoreEditorDialogProps) {
  const theme = useTheme();
  const accent = theme.palette.primary.main;
  const nameRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState(initialName);
  const [emoji, setEmoji] = useState(initialEmoji || DEFAULT_EMOJI);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Re-seed the draft whenever the dialog (re)opens.
  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setEmoji(initialEmoji || DEFAULT_EMOJI);
    const t = setTimeout(() => nameRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open, initialName, initialEmoji]);

  const canSave = name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({ name: name.trim(), emoji });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: tokens.surface.raised,
            border: `1px solid ${tokens.border.strong}`,
            borderRadius: `${tokens.radius.xl}px`,
            boxShadow: tokens.shadow.modal,
          },
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Box
          sx={{ px: 2.75, pt: 2.25, pb: 1.75, borderBottom: `1px solid ${tokens.border.subtle}` }}
        >
          <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>
            {mode === 'create' ? 'Add store' : 'Edit store'}
          </Box>
        </Box>

        <Box sx={{ px: 2.75, py: 2.5, display: 'flex', gap: 1.75, alignItems: 'flex-end' }}>
          <ButtonBase
            onClick={() => setPickerOpen(true)}
            aria-label="Choose store emoji"
            sx={{
              width: 54,
              height: 54,
              flexShrink: 0,
              borderRadius: `${tokens.radius.xl}px`,
              bgcolor: tokens.surface.elevated,
              border: `1px solid ${tokens.border.strong}`,
              fontSize: 26,
              '&:hover': { borderColor: accent },
            }}
          >
            {emoji}
          </ButtonBase>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <FieldLabel>Name</FieldLabel>
            <InputBase
              inputRef={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSave) handleSave();
              }}
              placeholder="Store name"
              inputProps={{ 'aria-label': 'Name' }}
              sx={{
                width: '100%',
                height: 40,
                px: 1.5,
                bgcolor: tokens.surface.elevated,
                border: `1px solid ${tokens.border.strong}`,
                borderRadius: `${tokens.radius.lg}px`,
                fontSize: 14,
                color: tokens.text.primary,
                '& input::placeholder': { color: tokens.text.muted, opacity: 1 },
                '&.Mui-focused': {
                  border: `1px solid ${accent}`,
                  boxShadow: `0 0 0 3px ${alpha(accent, 0.14)}`,
                },
              }}
            />
          </Box>
        </Box>

        <Box
          sx={{
            px: 2.75,
            py: 1.5,
            borderTop: `1px solid ${tokens.border.subtle}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1,
          }}
        >
          <Button
            onClick={onClose}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              color: tokens.text.secondary,
              border: `1px solid ${tokens.border.subtle}`,
              borderRadius: `${tokens.radius.lg}px`,
              px: 2,
              '&:hover': { bgcolor: 'transparent', color: tokens.text.primary },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              bgcolor: accent,
              color: tokens.onAccent.shop,
              borderRadius: `${tokens.radius.lg}px`,
              px: 2.25,
              '&:hover': { bgcolor: accent, filter: 'brightness(1.05)' },
              '&.Mui-disabled': { bgcolor: tokens.surface.elevated, color: tokens.text.muted },
            }}
          >
            {mode === 'create' ? 'Create store' : 'Update store'}
          </Button>
        </Box>
      </Box>

      <EmojiPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(picked) => setEmoji(picked || DEFAULT_EMOJI)}
        currentEmoji={emoji}
      />
    </Dialog>
  );
}
