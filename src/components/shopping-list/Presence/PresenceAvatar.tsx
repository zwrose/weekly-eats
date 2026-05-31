'use client';

import { Box } from '@mui/material';
import { tokens } from '@/lib/design-tokens';
import { presenceInitials, presenceColor } from './presence-utils';

export interface PresenceAvatarProps {
  name: string;
  email: string;
  size: number;
  ring?: boolean;
}

export function PresenceAvatar({ name, email, size, ring }: PresenceAvatarProps) {
  return (
    <Box
      aria-label={name}
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: presenceColor(email || name),
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...(ring && { border: `2px solid ${tokens.surface.raised}` }),
      }}
    >
      <Box
        component="span"
        sx={{
          fontSize: size * 0.42,
          fontWeight: 700,
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        {presenceInitials(name)}
      </Box>
    </Box>
  );
}
