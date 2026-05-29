// src/components/meal-plans/QtyEditor.tsx
'use client';

import { useEffect, useState } from 'react';
import { Box, Button, ButtonBase, Drawer, Popover, useMediaQuery, useTheme } from '@mui/material';
import { tokens } from '@/lib/design-tokens';

export interface QtyEditorProps {
  open: boolean;
  anchorEl: HTMLElement | null; // desktop popover anchor; ignored on mobile
  value: number;
  onCommit: (qty: number) => void;
  onClose: () => void;
}

const PRESETS: [string, number][] = [
  ['¼', 0.25],
  ['½', 0.5],
  ['¾', 0.75],
  ['1', 1],
  ['1½', 1.5],
  ['2', 2],
  ['3', 3],
];

function NumpadBody({
  value,
  onCommit,
  onClose,
}: {
  value: number;
  onCommit: (q: number) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const press = (k: string) => {
    if (k === '⌫') setDraft((d) => d.slice(0, -1));
    else if (k === '.') setDraft((d) => (d.includes('.') ? d : d + '.'));
    else setDraft((d) => (d === '0' ? k : d + k));
  };
  const commit = () => {
    const n = parseFloat(draft);
    if (!isNaN(n) && n > 0) onCommit(n);
  };

  return (
    <Box sx={{ p: 2, minWidth: 280 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Button onClick={onClose} sx={{ color: tokens.text.secondary }}>
          Cancel
        </Button>
        <Box
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 700,
            color: tokens.text.primary,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {draft || '0'}
        </Box>
        <Button onClick={commit} sx={{ color: tokens.section.plans, fontWeight: 600 }}>
          Done
        </Button>
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
        {PRESETS.map(([label, n]) => (
          <ButtonBase
            key={label}
            aria-label={/^\d+$/.test(label) ? `qty ${label}` : label}
            onClick={() => setDraft(String(n))}
            sx={{
              height: 28,
              px: 1.5,
              border: `1px solid ${tokens.border.subtle}`,
              borderRadius: `${tokens.radius.pill}px`,
              color: tokens.text.secondary,
              fontSize: 12,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {label}
          </ButtonBase>
        ))}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((k) => (
          <ButtonBase
            key={k}
            aria-label={k === '⌫' ? 'backspace' : k}
            onClick={() => press(k)}
            sx={{
              height: 50,
              borderRadius: `${tokens.radius.xl}px`,
              border: `1px solid ${tokens.border.subtle}`,
              bgcolor: /\d/.test(k) ? tokens.surface.raised : 'transparent',
              color: tokens.text.primary,
              fontSize: 20,
              fontWeight: 600,
            }}
          >
            {k}
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
}

export function QtyEditor({ open, anchorEl, value, onCommit, onClose }: QtyEditorProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const body = (
    <NumpadBody
      value={value}
      onCommit={(n) => {
        onCommit(n);
        onClose();
      }}
      onClose={onClose}
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
