'use client';

import type { ReactNode } from 'react';
import { Box, Button, ButtonBase, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';

export interface PantryListItem {
  _id: string;
  name: string;
}

export interface PantryListViewProps {
  items: PantryListItem[];
  total: number;
  onAddItem: () => void;
  onDeleteItem: (id: string) => void;
  /** Search control rendered in the bordered search box (page owns state). */
  search?: ReactNode;
  /** Pagination control rendered below the list (page owns it). */
  pagination?: ReactNode;
  /** Empty / no-results message slot. */
  emptyMessage?: ReactNode;
}

const PANTRY_ROW_GRID = '1fr 80px';

/** Pantry index — flat list of food items (desktop table + mobile card). Artboard §Desktop/Mobile List. */
export function PantryListView({
  items,
  total,
  onAddItem,
  onDeleteItem,
  search,
  pagination,
  emptyMessage,
}: PantryListViewProps) {
  const theme = useTheme();
  const isEmpty = items.length === 0;

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-end', sm: 'center' },
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
              fontSize: { xs: 28, md: 32 },
              fontWeight: 700,
              letterSpacing: '-0.025em',
              color: tokens.text.primary,
              lineHeight: 1.1,
            }}
          >
            Pantry
          </Typography>
          <Typography sx={{ fontSize: { xs: 12, md: 13 }, color: tokens.text.secondary, mt: 0.5 }}>
            <Box component="span" sx={{ color: theme.palette.primary.main, fontWeight: 600 }}>
              {total}
            </Box>{' '}
            {total === 1 ? 'item' : 'items'}
          </Typography>
        </Box>
        <Button
          onClick={onAddItem}
          startIcon={<Icon name="add" size={18} />}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            minHeight: 36,
            borderRadius: '10px',
            px: 2,
            bgcolor: theme.palette.primary.main,
            color: tokens.onAccent.pantry,
            '&:hover': { bgcolor: theme.palette.primary.main, filter: 'brightness(0.94)' },
          }}
        >
          <Box component="span" sx={{ display: { xs: 'inline', md: 'none' } }}>
            Add
          </Box>
          <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
            Add item
          </Box>
        </Button>
      </Box>

      {/* Search box — single bordered field; the slotted control's own TextField
          chrome is neutralized so we don't render a nested double-box. */}
      {search && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            height: 40,
            mb: 2,
            px: 1.5,
            bgcolor: tokens.surface.elevated,
            border: `1px solid ${tokens.border.strong}`,
            borderRadius: `${tokens.radius.xl}px`,
            '& > .MuiBox-root': { mb: 0, flex: 1, minWidth: 0 },
            '& .MuiOutlinedInput-root': { bgcolor: 'transparent', p: 0 },
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
      ) : (
        <>
          {/* Desktop table */}
          <Box
            sx={{
              display: { xs: 'none', md: 'block' },
              bgcolor: tokens.surface.raised,
              border: `1px solid ${tokens.border.subtle}`,
              borderRadius: '14px',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: PANTRY_ROW_GRID,
                p: '12px 22px',
                borderBottom: `1px solid ${tokens.border.subtle}`,
              }}
            >
              {['Food item', 'Remove'].map((label, i) => (
                <Typography
                  key={label}
                  sx={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: tokens.text.secondary,
                    textAlign: i === 1 ? 'right' : 'left',
                  }}
                >
                  {label}
                </Typography>
              ))}
            </Box>
            {items.map((item, i) => (
              <Box
                key={item._id}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: PANTRY_ROW_GRID,
                  alignItems: 'center',
                  p: '12px 22px',
                  borderBottom: i < items.length - 1 ? `1px solid ${tokens.border.subtle}` : 'none',
                  '&:hover': { bgcolor: tokens.surface.elevated },
                }}
              >
                <Typography sx={{ fontSize: 14, color: tokens.text.primary }}>
                  {item.name}
                </Typography>
                <Box sx={{ justifySelf: 'end' }}>
                  <ButtonBase
                    aria-label={`Remove ${item.name}`}
                    onClick={() => onDeleteItem(item._id)}
                    sx={{
                      width: 30,
                      height: 30,
                      borderRadius: '8px',
                      border: `1px solid ${tokens.border.subtle}`,
                      color: tokens.state.danger,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      '&:hover': { bgcolor: tokens.state.dangerMuted },
                    }}
                  >
                    <Icon name="delete" size={16} />
                  </ButtonBase>
                </Box>
              </Box>
            ))}
          </Box>

          {/* Mobile single card */}
          <Box
            sx={{
              display: { xs: 'block', md: 'none' },
              bgcolor: tokens.surface.raised,
              border: `1px solid ${tokens.border.subtle}`,
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            {items.map((item, i) => (
              <Box
                key={item._id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: '12px 14px',
                  borderBottom: i < items.length - 1 ? `1px solid ${tokens.border.subtle}` : 'none',
                }}
              >
                <Typography sx={{ flex: 1, fontSize: 14, color: tokens.text.primary }}>
                  {item.name}
                </Typography>
                <ButtonBase
                  aria-label={`Remove ${item.name}`}
                  onClick={() => onDeleteItem(item._id)}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '8px',
                    color: tokens.text.secondary,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="delete" size={17} />
                </ButtonBase>
              </Box>
            ))}
          </Box>

          {pagination}
        </>
      )}
    </Box>
  );
}
