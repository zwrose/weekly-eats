'use client';

import { Box, ButtonBase, IconButton, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';

export interface StoreSidebarStore {
  _id: string;
  name: string;
  emoji?: string;
  itemCount: number;
}

interface StoreSidebarProps {
  stores: StoreSidebarStore[];
  activeStoreId: string | null;
  onSelect: (id: string) => void;
  onAddStore: () => void;
  /**
   * Suppress the visible store-name text node, exposing the name only via the
   * row's `aria-label`. Used by the mobile working view, where the sidebar is
   * kept off-screen (for selection/role parity) while the pane header is the
   * single visible store-name source.
   */
  hideLabels?: boolean;
}

/** Fixed 280px store-picker column for the desktop two-pane working view. */
export function StoreSidebar({
  stores,
  activeStoreId,
  onSelect,
  onAddStore,
  hideLabels = false,
}: StoreSidebarProps) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        width: 280,
        flexShrink: 0,
        borderRight: `1px solid ${tokens.border.subtle}`,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        p: '20px 14px',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: '4px',
          py: '10px',
        }}
      >
        <Typography
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: 14,
            fontWeight: 700,
            color: tokens.text.primary,
          }}
        >
          Stores
        </Typography>
        <IconButton
          onClick={onAddStore}
          aria-label="Add store"
          sx={{
            width: 28,
            height: 28,
            color: tokens.text.secondary,
            '&:hover': { color: tokens.text.primary },
          }}
        >
          <Icon name="add" size={18} />
        </IconButton>
      </Box>

      {/* Rows */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, overflowY: 'auto' }}>
        {stores.map((store) => {
          const active = store._id === activeStoreId;
          return (
            <ButtonBase
              key={store._id}
              onClick={() => onSelect(store._id)}
              aria-current={active ? 'true' : undefined}
              aria-label={store.name}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                justifyContent: 'flex-start',
                textAlign: 'left',
                width: '100%',
                p: '8px 10px',
                borderRadius: `${tokens.radius.md}px`,
                bgcolor: active ? alpha(theme.palette.primary.main, 0.14) : 'transparent',
                border: active
                  ? `1px solid ${alpha(theme.palette.primary.main, 0.33)}`
                  : '1px solid transparent',
                transition: 'background-color 120ms ease',
                '&:hover': {
                  bgcolor: active
                    ? alpha(theme.palette.primary.main, 0.14)
                    : tokens.surface.elevated,
                },
              }}
            >
              <Box component="span" sx={{ fontSize: 18, lineHeight: 1 }} aria-hidden>
                {store.emoji ?? '🛒'}
              </Box>
              {hideLabels ? (
                <Box sx={{ flex: 1, minWidth: 0 }} aria-hidden />
              ) : (
                <Typography
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 13,
                    fontWeight: active ? 600 : 500,
                    color: tokens.text.primary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {store.name}
                </Typography>
              )}
              <Typography
                component="span"
                sx={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: active ? theme.palette.primary.main : tokens.text.muted,
                }}
              >
                {store.itemCount}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}
