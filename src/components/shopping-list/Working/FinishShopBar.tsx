'use client';

import { Box, ButtonBase, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';

export interface FinishShopBarProps {
  boughtCount: number;
  onFinish: () => void;
}

export function FinishShopBar({ boughtCount, onFinish }: FinishShopBarProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  if (boughtCount === 0) return null;

  return (
    <Box
      sx={{
        bgcolor: tokens.surface.base,
        borderTop: `1px solid ${tokens.border.subtle}`,
        px: 2,
        py: 1,
        display: 'flex',
        justifyContent: isMobile ? 'stretch' : 'flex-end',
      }}
    >
      <ButtonBase
        onClick={onFinish}
        aria-label={`Finish shop · ${boughtCount} bought`}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          px: 2.5,
          height: isMobile ? 48 : 46,
          width: isMobile ? '100%' : 'auto',
          bgcolor: theme.palette.primary.main,
          color: tokens.onAccent.shop,
          borderRadius: `${tokens.radius.xl}px`,
          fontWeight: 600,
          fontSize: 14,
          letterSpacing: 0.1,
          '&:hover': {
            opacity: 0.9,
          },
          '&:active': {
            opacity: 0.8,
          },
        }}
      >
        <Icon name="done_all" size={20} />
        {`Finish shop · ${boughtCount} bought`}
      </ButtonBase>
    </Box>
  );
}
