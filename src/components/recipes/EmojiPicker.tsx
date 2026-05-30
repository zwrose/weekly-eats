'use client';

import { useMemo, useState } from 'react';
import { Box, Drawer, Dialog, InputBase, ButtonBase, useMediaQuery, useTheme } from '@mui/material';
import { tokens } from '@/lib/design-tokens';
import { FOOD_EMOJIS } from '@/components/EmojiPicker';
import { RECIPE_ACCENT_MUTED } from './recipe-display-utils';

export interface EmojiPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  currentEmoji?: string;
}

export function EmojiPicker({ open, onClose, onSelect, currentEmoji }: EmojiPickerProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return FOOD_EMOJIS;
    // FOOD_EMOJIS is `{ emoji: string; description: string }[]` (verified in src/components/EmojiPicker.tsx).
    return FOOD_EMOJIS.filter((e) => e.description.toLowerCase().includes(needle));
  }, [q]);

  const clear = () => {
    onSelect('');
    onClose();
  };

  const body = (
    <Box sx={{ display: 'flex', flexDirection: 'column', maxHeight: isDesktop ? '80vh' : '78vh' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.5,
          py: 1.75,
          borderBottom: `1px solid ${tokens.border.subtle}`,
        }}
      >
        {isDesktop ? (
          <>
            <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>
              Pick an emoji
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <ButtonBase
                onClick={clear}
                sx={{
                  fontSize: 14,
                  color: tokens.text.secondary,
                  border: `1px solid ${tokens.border.strong}`,
                  borderRadius: `${tokens.radius.md}px`,
                  px: 2,
                  py: 0.75,
                  '&:hover': { bgcolor: tokens.surface.elevated, color: tokens.text.primary },
                }}
              >
                Clear
              </ButtonBase>
              <ButtonBase
                onClick={onClose}
                sx={{
                  fontSize: 14,
                  fontWeight: 600,
                  bgcolor: tokens.section.recipes,
                  color: '#0c1118',
                  borderRadius: `${tokens.radius.md}px`,
                  px: 2.5,
                  py: 0.75,
                  '&:hover': { filter: 'brightness(1.08)' },
                }}
              >
                Done
              </ButtonBase>
            </Box>
          </>
        ) : (
          <>
            <ButtonBase
              onClick={clear}
              sx={{
                minWidth: 56,
                justifyContent: 'flex-start',
                color: tokens.text.secondary,
                fontSize: 14,
              }}
            >
              Clear
            </ButtonBase>
            <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>
              Pick an emoji
            </Box>
            <ButtonBase
              onClick={onClose}
              sx={{
                minWidth: 56,
                justifyContent: 'flex-end',
                color: tokens.section.recipes,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Done
            </ButtonBase>
          </>
        )}
      </Box>
      <Box sx={{ px: 2.5, pt: 1.5 }}>
        <InputBase
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search emoji"
          inputProps={{ 'aria-label': 'Search emoji' }}
          sx={{
            width: '100%',
            height: 38,
            px: 1.5,
            bgcolor: tokens.surface.elevated,
            border: `1px solid ${tokens.border.strong}`,
            borderRadius: `${tokens.radius.lg}px`,
            color: tokens.text.primary,
            fontSize: 13,
          }}
        />
      </Box>
      <Box sx={{ overflowY: 'auto', p: 2.5 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${isDesktop ? 10 : 8}, 1fr)`,
            gap: '4px',
          }}
        >
          {filtered.map((e, i) => {
            const em = e.emoji;
            const selected = em === currentEmoji;
            return (
              <ButtonBase
                key={`${i}-${em}`}
                aria-label={`emoji ${em}`}
                onClick={() => {
                  onSelect(em);
                  onClose();
                }}
                sx={{
                  height: isDesktop ? 40 : 38,
                  fontSize: 22,
                  borderRadius: `${tokens.radius.md}px`,
                  bgcolor: selected ? RECIPE_ACCENT_MUTED : 'transparent',
                  border: `1px solid ${selected ? tokens.section.recipes : 'transparent'}`,
                }}
              >
                {em}
              </ButtonBase>
            );
          })}
        </Box>
      </Box>
    </Box>
  );

  if (isDesktop) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        slotProps={{
          paper: {
            sx: {
              width: 520,
              bgcolor: tokens.surface.raised,
              borderRadius: `${tokens.radius.xxxl}px`,
              border: `1px solid ${tokens.border.subtle}`,
            },
          },
        }}
      >
        {body}
      </Dialog>
    );
  }
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            bgcolor: tokens.surface.sheet,
            borderTopLeftRadius: `${tokens.radius.sheet}px`,
            borderTopRightRadius: `${tokens.radius.sheet}px`,
          },
        },
      }}
    >
      {body}
    </Drawer>
  );
}
