'use client';

import React from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

interface ListRowProps {
  children: React.ReactNode;
  onClick?: () => void;
  accentColor?: string;
  sx?: SxProps<Theme>;
  selected?: boolean;
}

export const ListRow: React.FC<ListRowProps> = React.memo(function ListRow({
  children,
  onClick,
  accentColor,
  sx,
  selected = false,
}) {
  return (
    <Box
      data-testid="list-row"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      sx={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 36,
        px: 1.5,
        py: 1,
        borderBottom: '1px solid',
        borderBottomColor: 'divider',
        borderLeft: '2px solid transparent',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background var(--duration-fast)',
        backgroundColor: selected ? 'action.selected' : 'transparent',
        '&:hover': onClick
          ? {
              backgroundColor: 'action.hover',
              ...(accentColor ? { borderLeftColor: accentColor } : {}),
            }
          : {},
        ...(sx as object),
      }}
    >
      {children}
    </Box>
  );
});
