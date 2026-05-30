'use client';

import type { ReactNode } from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';

export interface StoreListItem {
  _id: string;
  name: string;
  emoji?: string;
  itemCount: number;
  shared?: boolean;
}

interface StoreCardProps {
  store: StoreListItem;
  onSelect: (id: string) => void;
  /** Optional trailing actions (owner controls). When omitted, a chevron is shown. */
  actions?: ReactNode;
}

/** Mobile store card — artboard §3.1. */
export function StoreCard({ store, onSelect, actions }: StoreCardProps) {
  const theme = useTheme();
  const hasItems = store.itemCount > 0;
  return (
    <Box
      sx={{
        position: 'relative',
        bgcolor: tokens.surface.raised,
        border: `1px solid ${tokens.border.subtle}`,
        borderRadius: '12px',
        mb: 1.5,
      }}
    >
      <ButtonBase
        onClick={() => onSelect(store._id)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          width: '100%',
          textAlign: 'left',
          justifyContent: 'flex-start',
          p: '14px',
          borderRadius: '12px',
        }}
      >
        <Box
          component="span"
          sx={{
            flex: '0 0 40px',
            width: 40,
            height: 40,
            borderRadius: '10px',
            bgcolor: tokens.surface.elevated,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
          }}
        >
          {store.emoji}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
            <Typography
              sx={{
                fontFamily: 'var(--font-display)',
                fontSize: 15,
                fontWeight: 700,
                color: tokens.text.primary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {store.name}
            </Typography>
            {store.shared && (
              <Icon
                name="group"
                size={13}
                color={tokens.text.secondary}
                aria-label="Shared store"
              />
            )}
          </Box>
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 600,
              color: hasItems ? theme.palette.primary.main : tokens.text.muted,
              mt: 0.25,
            }}
          >
            {hasItems ? `${store.itemCount} to buy` : 'List empty'}
          </Typography>
        </Box>
        {!actions && (
          <Box
            component="span"
            sx={{ fontSize: 14, color: tokens.text.secondary, flexShrink: 0, lineHeight: 1 }}
          >
            ›
          </Box>
        )}
      </ButtonBase>
      {actions && (
        <Box
          sx={{
            display: 'flex',
            gap: 0.5,
            justifyContent: 'flex-end',
            px: '14px',
            pb: '10px',
          }}
        >
          {actions}
        </Box>
      )}
    </Box>
  );
}
