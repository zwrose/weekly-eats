'use client';

import { Box, ButtonBase } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';

export interface AddItemRowProps {
  onClick: () => void;
}

export function AddItemRow({ onClick }: AddItemRowProps) {
  const theme = useTheme();

  return (
    <ButtonBase
      onClick={onClick}
      aria-label="Add item"
      sx={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.75,
        px: 2,
        py: 1.25,
        border: `1px dashed ${tokens.border.strong}`,
        borderRadius: `${tokens.radius.xl}px`,
        color: theme.palette.primary.main,
        fontSize: 14,
        fontWeight: 600,
        '&:hover': { bgcolor: tokens.surface.elevated },
      }}
    >
      <Icon name="add" size={18} color="inherit" />
      Add item
    </ButtonBase>
  );
}
