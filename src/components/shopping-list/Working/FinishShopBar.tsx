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
        position: 'absolute',
        left: { xs: 0, md: 280 },
        right: 0,
        bottom: 0,
        bgcolor: tokens.surface.base,
        borderTop: `1px solid ${tokens.border.subtle}`,
        px: { xs: '16px', md: '32px' },
        pt: { xs: '12px', md: '14px' },
        pb: '22px',
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
          fontWeight: 700,
          fontSize: isMobile ? 15 : 14.5,
          letterSpacing: 0.1,
          '&:hover': {
            opacity: 0.9,
          },
          '&:active': {
            opacity: 0.8,
          },
        }}
      >
        <Icon name="done_all" size={18} />
        {`Finish shop · ${boughtCount} bought`}
      </ButtonBase>
    </Box>
  );
}
