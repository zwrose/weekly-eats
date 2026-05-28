// src/components/nav/NavAvatar.tsx
'use client';

import { Box } from '@mui/material';

/** Up to two initials from a display name; '?' when empty. */
export function initialsFromName(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface NavAvatarProps {
  name?: string | null;
  size?: number;
}

export function NavAvatar({ name, size = 28 }: NavAvatarProps) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #5b6d8c, #3d4a64)',
        color: 'text.primary',
        fontSize: size * 0.4,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {initialsFromName(name)}
    </Box>
  );
}
