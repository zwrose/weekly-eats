// src/components/meal-plans/UnitEditor.tsx
'use client';

import { useMemo, useState } from 'react';
import {
  Box,
  ButtonBase,
  InputBase,
  Drawer,
  Popover,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { tokens } from '@/lib/design-tokens';
import { getUnitOptions, getUnitForm } from '@/lib/food-items-utils';

export interface UnitEditorProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  value: string;
  quantity: number;
  onCommit: (unit: string) => void;
  onClose: () => void;
}

function PickerBody({
  value,
  quantity,
  onCommit,
}: {
  value: string;
  quantity: number;
  onCommit: (u: string) => void;
}) {
  const [q, setQ] = useState('');
  const options = useMemo(() => getUnitOptions(), []);
  const filtered = options.filter((o) => o.value.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <Box sx={{ p: 1.5, minWidth: 280, maxHeight: 360, display: 'flex', flexDirection: 'column' }}>
      <InputBase
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search units"
        sx={{
          mb: 1,
          px: 1.5,
          py: 1,
          bgcolor: tokens.surface.elevated,
          border: `1px solid ${tokens.border.strong}`,
          borderRadius: `${tokens.radius.lg}px`,
          fontSize: 13,
          color: tokens.text.primary,
          '& input::placeholder': { color: tokens.text.muted, opacity: 1 },
        }}
      />
      <Box sx={{ overflowY: 'auto' }}>
        {filtered.map((o) => {
          const selected = o.value === value;
          return (
            <ButtonBase
              key={o.value}
              onClick={() => onCommit(o.value)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                width: '100%',
                justifyContent: 'flex-start',
                textAlign: 'left',
                px: 1.5,
                py: 1.125,
                borderRadius: `${tokens.radius.md}px`,
                bgcolor: selected ? tokens.accent.muted : 'transparent',
              }}
            >
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: `1.5px solid ${selected ? tokens.section.plans : tokens.border.strong}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {selected && (
                  <Box
                    sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: tokens.section.plans }}
                  />
                )}
              </Box>
              <Box
                sx={{
                  flex: 1,
                  fontSize: 14,
                  color: tokens.text.primary,
                  fontWeight: selected ? 600 : 500,
                }}
              >
                {getUnitForm(o.value, quantity)}
              </Box>
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}

export function UnitEditor({
  open,
  anchorEl,
  value,
  quantity,
  onCommit,
  onClose,
}: UnitEditorProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const body = (
    <PickerBody
      value={value}
      quantity={quantity}
      onCommit={(u) => {
        onCommit(u);
        onClose();
      }}
    />
  );

  if (isDesktop) {
    return (
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: tokens.surface.sheet,
              borderRadius: `${tokens.radius.xl}px`,
              border: `1px solid ${tokens.border.subtle}`,
            },
          },
        }}
      >
        {body}
      </Popover>
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
            borderTopLeftRadius: tokens.radius.sheet,
            borderTopRightRadius: tokens.radius.sheet,
          },
        },
      }}
    >
      {body}
    </Drawer>
  );
}
