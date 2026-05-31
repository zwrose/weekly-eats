'use client';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import { tokens } from '@/lib/design-tokens';

interface KeepSkipToggleProps {
  value: 'keep' | 'skip';
  onChange: (next: 'keep' | 'skip') => void;
}

export function KeepSkipToggle({ value, onChange }: KeepSkipToggleProps) {
  const segmentBase = {
    px: '11px',
    py: '5px',
    borderRadius: `${tokens.radius.pill}px`,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
  };

  return (
    <Box
      sx={{
        display: 'inline-flex',
        bgcolor: tokens.surface.elevated,
        border: `1px solid ${tokens.border.subtle}`,
        borderRadius: `${tokens.radius.pill}px`,
        p: '2px',
      }}
    >
      <ButtonBase
        aria-label="Keep"
        aria-pressed={value === 'keep'}
        onClick={() => onChange('keep')}
        sx={{
          ...segmentBase,
          bgcolor: value === 'keep' ? tokens.state.success : 'transparent',
          color: value === 'keep' ? tokens.onAccent.shop : tokens.text.secondary,
        }}
      >
        Keep
      </ButtonBase>
      <ButtonBase
        aria-label="Skip"
        aria-pressed={value === 'skip'}
        onClick={() => onChange('skip')}
        sx={{
          ...segmentBase,
          bgcolor: value === 'skip' ? tokens.state.danger : 'transparent',
          color: value === 'skip' ? tokens.onDanger : tokens.text.secondary,
        }}
      >
        Skip
      </ButtonBase>
    </Box>
  );
}
