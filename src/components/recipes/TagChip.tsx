'use client';

import { Box } from '@mui/material';
import { tokens } from '@/lib/design-tokens';
import { accessLevelMeta, type AccessLevel } from './recipe-display-utils';

export function TagChip({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        fontSize: small ? 10 : 11,
        color: tokens.text.secondary,
        px: small ? '6px' : '8px',
        py: small ? '1px' : '2px',
        border: `1px solid ${tokens.border.subtle}`,
        borderRadius: `${tokens.radius.pill}px`,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </Box>
  );
}

export function AccessChip({ access }: { access: AccessLevel }) {
  const { label, color } = accessLevelMeta(access);
  return (
    <Box
      component="span"
      sx={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color,
        px: '8px',
        py: '3px',
        border: `1px solid ${tokens.border.subtle}`,
        borderRadius: `${tokens.radius.pill}px`,
      }}
    >
      {label}
    </Box>
  );
}
