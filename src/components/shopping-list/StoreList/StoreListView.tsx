'use client';

import type { ReactNode } from 'react';
import { Box, Button, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';
import { StoreCard, type StoreListItem } from './StoreCard';
import { StoreRow, STORE_ROW_GRID } from './StoreRow';
import { PendingInviteBanner, type PendingInvite } from './PendingInviteBanner';

interface StoreListViewProps {
  stores: StoreListItem[];
  onSelectStore: (id: string) => void;
  onAddStore: () => void;
  /** Empty/no-results message slot (page owns search state). */
  emptyMessage?: ReactNode;
  /** Search bar rendered above the table (desktop only) — page owns the control. */
  search?: ReactNode;
  /** Pagination control rendered below the list — page owns it. */
  pagination?: ReactNode;
  pendingInvitations?: PendingInvite[];
  onAcceptInvite?: (storeId: string) => void;
  onDeclineInvite?: (storeId: string) => void;
}

const COLUMN_LABELS = ['', 'Name', 'To buy', 'Shared with', 'Last shop', ''];

export function StoreListView({
  stores,
  onSelectStore,
  onAddStore,
  emptyMessage,
  search,
  pagination,
  pendingInvitations,
  onAcceptInvite,
  onDeclineInvite,
}: StoreListViewProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const isEmpty = stores.length === 0;
  const totalItems = stores.reduce((sum, store) => sum + store.itemCount, 0);

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          gap: 1.5,
          mb: { xs: 2, md: 3 },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="h1"
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: { xs: 26, md: 32 },
              fontWeight: 700,
              letterSpacing: { xs: '-0.02em', md: '-0.025em' },
              color: tokens.text.primary,
              lineHeight: 1.1,
            }}
          >
            Shopping
          </Typography>
          <Typography sx={{ fontSize: { xs: 12, md: 13 }, color: tokens.text.secondary, mt: 0.5 }}>
            <Box component="span" sx={{ color: theme.palette.primary.main, fontWeight: 600 }}>
              {stores.length}
            </Box>{' '}
            {stores.length === 1 ? 'store' : 'stores'} ·{' '}
            <Box component="span" sx={{ color: theme.palette.primary.main, fontWeight: 600 }}>
              {totalItems}
            </Box>{' '}
            items to buy
            <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
              {' '}
              across all
            </Box>
          </Typography>
        </Box>
        <Button
          onClick={onAddStore}
          startIcon={<Icon name="add" size={18} />}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            minHeight: 36,
            borderRadius: '10px',
            px: 2,
            bgcolor: theme.palette.primary.main,
            color: tokens.onAccent.shop,
            '&:hover': { bgcolor: theme.palette.primary.main, filter: 'brightness(0.94)' },
          }}
        >
          <Box component="span" sx={{ display: { xs: 'inline', md: 'none' } }}>
            Store
          </Box>
          <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
            Add store
          </Box>
        </Button>
      </Box>

      {/* Pending invitations */}
      {pendingInvitations?.map((invite) => (
        <PendingInviteBanner
          key={invite.storeId}
          invite={invite}
          onAccept={(id) => onAcceptInvite?.(id)}
          onDecline={(id) => onDeclineInvite?.(id)}
        />
      ))}

      {/* Desktop search bar — single bordered field; the slotted control's own
          TextField border/background/margin is neutralized so we don't render a
          nested double-box. */}
      {search && isDesktop && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            height: 40,
            maxWidth: 360,
            mb: 2,
            px: 1.5,
            bgcolor: tokens.surface.elevated,
            border: `1px solid ${tokens.border.strong}`,
            borderRadius: `${tokens.radius.xl}px`,
            // Flatten the inner search control into a borderless input.
            '& > .MuiBox-root': { mb: 0, flex: 1, minWidth: 0 },
            '& .MuiOutlinedInput-root': {
              bgcolor: 'transparent',
              p: 0,
            },
            '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
            '& .MuiOutlinedInput-input': { p: 0 },
          }}
        >
          <Icon name="search" size={18} color={tokens.text.secondary} />
          {search}
        </Box>
      )}

      {isEmpty ? (
        <Box sx={{ py: 4 }}>{emptyMessage}</Box>
      ) : isDesktop ? (
        <>
          {/* Desktop table */}
          <Box
            sx={{
              bgcolor: tokens.surface.raised,
              border: `1px solid ${tokens.border.subtle}`,
              borderRadius: '14px',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: STORE_ROW_GRID,
                p: '12px 22px',
                borderBottom: `1px solid ${tokens.border.subtle}`,
              }}
            >
              {COLUMN_LABELS.map((label, i) => (
                <Typography
                  key={i}
                  sx={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: tokens.text.secondary,
                    textAlign: i === COLUMN_LABELS.length - 1 ? 'right' : 'left',
                  }}
                >
                  {label}
                </Typography>
              ))}
            </Box>
            {stores.map((store, i) => (
              <StoreRow
                key={store._id}
                store={store}
                onSelect={onSelectStore}
                isLast={i === stores.length - 1}
              />
            ))}
          </Box>

          {pagination}
        </>
      ) : (
        <>
          {/* Mobile section label */}
          <Typography
            component="h2"
            sx={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: tokens.text.secondary,
              margin: '6px 4px 8px',
            }}
          >
            Your stores
          </Typography>

          {/* Mobile cards */}
          {stores.map((store) => (
            <StoreCard key={store._id} store={store} onSelect={onSelectStore} />
          ))}

          {pagination}
        </>
      )}
    </Box>
  );
}
