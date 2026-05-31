'use client';

import { Box, ButtonBase, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';
import type { StoreListItem } from './StoreCard';

export const STORE_ROW_GRID = '60px 1fr 140px 180px 90px';

interface StoreRowProps {
  store: StoreListItem;
  onSelect: (id: string) => void;
  isLast?: boolean;
}

/** Desktop store table row — artboard §3.1. */
export function StoreRow({ store, onSelect, isLast }: StoreRowProps) {
  const theme = useTheme();
  const hasItems = store.itemCount > 0;
  return (
    <Box
      sx={{
        position: 'relative',
        borderBottom: isLast ? 'none' : `1px solid ${tokens.border.subtle}`,
        '&:hover': { bgcolor: tokens.surface.elevated },
      }}
    >
      <ButtonBase
        onClick={() => onSelect(store._id)}
        sx={{
          display: 'grid',
          gridTemplateColumns: STORE_ROW_GRID,
          alignItems: 'center',
          width: '100%',
          textAlign: 'left',
          justifyItems: 'start',
          p: '14px 22px',
        }}
      >
        <Box component="span" sx={{ fontSize: 24, lineHeight: 1 }}>
          {store.emoji}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, width: '100%' }}>
          <Typography
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              fontWeight: 700,
              color: tokens.text.primary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {store.name}
          </Typography>
        </Box>
        <Typography
          sx={{
            fontSize: 13,
            fontWeight: 600,
            color: hasItems ? theme.palette.primary.main : tokens.text.muted,
          }}
        >
          {hasItems ? `${store.itemCount} items` : 'Empty'}
        </Typography>
        <Box sx={{ minWidth: 0, width: '100%' }}>
          {store.shared ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
              <Icon
                name="group"
                size={16}
                color={tokens.text.secondary}
                aria-label="Shared store"
              />
              <Typography sx={{ fontSize: 13, color: tokens.text.secondary }} noWrap>
                {store.sharedCount && store.sharedCount > 0
                  ? `${store.sharedCount} ${store.sharedCount === 1 ? 'person' : 'people'}`
                  : 'Shared'}
              </Typography>
            </Box>
          ) : (
            <Typography sx={{ fontSize: 13, color: tokens.text.muted }}>Just you</Typography>
          )}
        </Box>
        <Box sx={{ justifySelf: 'end', display: 'flex' }}>
          <Icon name="chevron_right" size={18} color={tokens.text.secondary} />
        </Box>
      </ButtonBase>
    </Box>
  );
}
