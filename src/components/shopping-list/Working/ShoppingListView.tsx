'use client';

import type { ReactNode } from 'react';
import { Box, ButtonBase, Checkbox, Divider, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';
import { getUnitForm } from '@/lib/food-items-utils';
import type { ActiveUser } from '@/lib/hooks';
import type { ShoppingListItem } from '@/types/shopping-list';
import { StoreSidebar, type StoreSidebarStore } from './StoreSidebar';

export interface ShoppingListViewProps {
  stores: StoreSidebarStore[];
  activeStoreId: string | null;
  items: ShoppingListItem[];
  onSelectStore: (id: string) => void;
  onToggleItem: (foodItemId: string) => void;
  onEditItem: (item: ShoppingListItem) => void;
  onAddItem: () => void;
  onBack: () => void;
  /**
   * View-level handlers/state the page still owns. Currently surfaced through
   * the presence/finish slots (which carry the page's live constructs), so they
   * are accepted but not consumed directly yet. Tasks 6/7/10 restyle/extract
   * these (finish-shop, presence pill, actions menu) and will wire them here.
   */
  onFinish: () => void;
  onReconnect: () => void;
  connectionState: 'connected' | 'connecting' | 'disconnected';
  activeUsers: ActiveUser[];
  /** Add-store affordance for the sidebar. Optional; defaults to onAddItem-less no-op. */
  onAddStore?: () => void;
  /** Presence cluster (live pill + "also viewing") — page passes its existing construct. */
  presenceSlot?: ReactNode;
  /** Actions cluster (overflow menu trigger) — page passes its existing construct. */
  actionsSlot?: ReactNode;
  /** Finish-shop trigger — page passes its existing construct. */
  finishSlot?: ReactNode;
  /** Replaces the default item rows with the page's DnD list when provided. */
  listSlot?: ReactNode;
}

function itemSubtitle(item: ShoppingListItem): string {
  const unitForm =
    item.unit && item.unit !== 'each'
      ? getUnitForm(item.unit, item.quantity)
      : item.unit === 'each'
        ? 'each'
        : '';
  return `${item.quantity} ${unitForm}`.trim();
}

/** Minimal ported item row (Task 5 extracts/restyles ShoppingItemRow). */
function DefaultItemRow({
  item,
  onToggle,
  onEdit,
}: {
  item: ShoppingListItem;
  onToggle: (foodItemId: string) => void;
  onEdit: (item: ShoppingListItem) => void;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.25 }}>
      <Checkbox
        checked={item.checked}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(item.foodItemId);
        }}
      />
      <ButtonBase
        onClick={() => onEdit(item)}
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          textAlign: 'left',
          py: 0.5,
        }}
      >
        <Typography
          sx={{
            fontSize: 14,
            color: tokens.text.primary,
            textDecoration: item.checked ? 'line-through' : 'none',
            opacity: item.checked ? 0.6 : 1,
          }}
        >
          {item.name}
        </Typography>
        <Typography sx={{ fontSize: 12, color: tokens.text.secondary }}>
          {itemSubtitle(item)}
        </Typography>
      </ButtonBase>
    </Box>
  );
}

/**
 * In-page working shopping list — two-pane on desktop (StoreSidebar + pane),
 * pushed pane on mobile. Replaces the former modal Dialog. The page keeps
 * owning data/state/sync/DnD and passes the live list via `listSlot` plus the
 * presence/actions/finish constructs via their slots.
 */
export function ShoppingListView({
  stores,
  activeStoreId,
  items,
  onSelectStore,
  onToggleItem,
  onEditItem,
  onAddItem,
  onBack,
  onAddStore,
  presenceSlot,
  actionsSlot,
  finishSlot,
  listSlot,
}: ShoppingListViewProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const activeStore = stores.find((s) => s._id === activeStoreId) ?? null;
  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  const renderSidebar = (hideLabels: boolean) => (
    <StoreSidebar
      stores={stores}
      activeStoreId={activeStoreId}
      onSelect={onSelectStore}
      onAddStore={onAddStore ?? (() => {})}
      hideLabels={hideLabels}
    />
  );

  const pane = (
    <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, flex: 1 }}>
      {/* Mobile back affordance */}
      {!isDesktop && (
        <ButtonBase
          onClick={onBack}
          sx={{
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            mb: 1.5,
            px: 0.5,
            py: 0.5,
            color: tokens.text.secondary,
            fontSize: 14,
            '&:hover': { color: tokens.text.primary },
          }}
        >
          <Icon name="chevron_left" size={20} />
          Stores
        </ButtonBase>
      )}

      {/* Store header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, minWidth: 0 }}>
        <Box component="span" sx={{ fontSize: 40, lineHeight: 1 }} aria-hidden>
          {activeStore?.emoji ?? '🛒'}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            component="h2"
            noWrap
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              fontWeight: 700,
              lineHeight: 1.1,
              color: tokens.text.primary,
            }}
          >
            {activeStore?.name ?? 'Shopping list'}
          </Typography>
          <Typography sx={{ fontSize: 13, color: tokens.text.secondary, mt: 0.25 }}>
            {unchecked.length} to buy · {checked.length} in cart
          </Typography>
        </Box>
        {presenceSlot}
        {actionsSlot}
      </Box>

      {/* Finish-shop trigger */}
      {finishSlot && <Box sx={{ mb: 1.5 }}>{finishSlot}</Box>}

      {/* Item list */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {listSlot ?? (
          <>
            {unchecked.map((item) => (
              <DefaultItemRow
                key={item.foodItemId}
                item={item}
                onToggle={onToggleItem}
                onEdit={onEditItem}
              />
            ))}
            {checked.length > 0 && (
              <>
                {unchecked.length > 0 && <Divider sx={{ my: 1 }} />}
                {checked.map((item) => (
                  <DefaultItemRow
                    key={item.foodItemId}
                    item={item}
                    onToggle={onToggleItem}
                    onEdit={onEditItem}
                  />
                ))}
              </>
            )}
          </>
        )}
      </Box>

      {/* Add-item row */}
      <ButtonBase
        onClick={onAddItem}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          alignSelf: 'flex-start',
          mt: 1.5,
          px: 1,
          py: 0.75,
          color: theme.palette.primary.main,
          fontSize: 14,
          fontWeight: 600,
          borderRadius: `${tokens.radius.md}px`,
          '&:hover': { bgcolor: tokens.surface.elevated },
        }}
      >
        <Icon name="add" size={18} />
        Add item
      </ButtonBase>
    </Box>
  );

  if (isDesktop) {
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: '280px 1fr', minHeight: 0 }}>
        {renderSidebar(false)}
        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, p: 2 }}>{pane}</Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {pane}
      {/* Sidebar kept rendered (off-screen) on mobile for selection parity and
          deep-link restore; the page's StoreListView is the visible mobile
          index. Off-screen positioning keeps the rows clickable/queryable. */}
      <Box aria-hidden={false} sx={{ position: 'absolute', left: -10000, top: 0, width: 280 }}>
        {renderSidebar(true)}
      </Box>
    </Box>
  );
}
