'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { Box, ButtonBase, Checkbox, Divider, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';
import { getUnitForm } from '@/lib/food-items-utils';
import type { ActiveUser, ShoppingSyncConnectionState } from '@/lib/hooks/use-shopping-sync';
import type { ShoppingListItem } from '@/types/shopping-list';
import { StoreSidebar, type StoreSidebarStore } from './StoreSidebar';
import { AddItemRow } from './AddItemRow';
import { FinishShopBar } from './FinishShopBar';
import { FinishShopConfirm } from './FinishShopConfirm';
import { PresencePill } from '../Presence/PresencePill';
import { StoreActionsMenu } from './StoreActionsMenu';

export interface ShoppingListViewProps {
  stores: StoreSidebarStore[];
  activeStoreId: string | null;
  items: ShoppingListItem[];
  onSelectStore: (id: string) => void;
  onToggleItem: (foodItemId: string) => void;
  onEditItem: (item: ShoppingListItem) => void;
  onAddItem: () => void;
  onBack: () => void;
  onFinish: () => void;
  onReconnect: () => void;
  connectionState: ShoppingSyncConnectionState;
  activeUsers: ActiveUser[];
  /** Add-store affordance for the sidebar. Optional; defaults to onAddItem-less no-op. */
  onAddStore?: () => void;
  /** Action callbacks forwarded into the store overflow menu. */
  onImport: () => void;
  onPantryCheck: () => void;
  onHistory: () => void;
  onShare: () => void;
  onRename: () => void;
  onDelete: () => void;
  canLeave?: boolean;
  onLeave?: () => void;
  loadingPantryCheck?: boolean;
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
  onFinish,
  onReconnect,
  connectionState,
  activeUsers,
  onImport,
  onPantryCheck,
  onHistory,
  onShare,
  onRename,
  onDelete,
  canLeave,
  onLeave,
  loadingPantryCheck,
  listSlot,
}: ShoppingListViewProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const isMobile = !isDesktop;

  const [confirmOpen, setConfirmOpen] = useState(false);

  // Desktop header ghost button (Import / Pantry) — btnGhost vocab from artboard §3.2.
  const headerActionSx = {
    height: 36,
    px: 1.75,
    gap: 0.75,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    borderRadius: `${tokens.radius.lg}px`,
    border: `1px solid ${tokens.border.subtle}`,
    color: tokens.text.primary,
    fontFamily: 'var(--font-body)',
    fontSize: 13.5,
    fontWeight: 600,
  } as const;

  const activeStore = stores.find((s) => s._id === activeStoreId) ?? null;
  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);
  const checkedCount = checked.length;
  const remainingCount = unchecked.length;

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
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        flex: 1,
        padding: { xs: '14px 14px 100px', md: '24px 32px 110px' },
      }}
    >
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
            color: theme.palette.primary.main,
            fontSize: 14,
            '&:hover': { opacity: 0.85 },
          }}
        >
          <Icon name="chevron_left" size={18} />
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
              fontSize: { xs: 22, md: 28 },
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: { xs: '-0.02em', md: '-0.025em' },
              color: tokens.text.primary,
            }}
          >
            {activeStore?.name ?? 'Shopping list'}
          </Typography>
          <Typography sx={{ fontSize: 13, color: tokens.text.secondary, mt: 0.25 }}>
            {unchecked.length} to buy · {checked.length} in cart
          </Typography>
        </Box>
        <PresencePill
          connectionState={connectionState}
          activeUsers={activeUsers}
          onReconnect={onReconnect}
        />
        {/* Desktop: Import + Pantry are dedicated header buttons (artboard §3.2); the overflow
            menu carries the rest. Mobile: all actions live in the menu (no room for inline buttons). */}
        {isDesktop && (
          <>
            <ButtonBase onClick={onImport} sx={headerActionSx}>
              <Icon name="event_note" size={16} color={tokens.section.plans} />
              Import from plans
            </ButtonBase>
            <ButtonBase
              onClick={onPantryCheck}
              disabled={loadingPantryCheck}
              sx={{ ...headerActionSx, opacity: loadingPantryCheck ? 0.5 : 1 }}
            >
              <Icon name="kitchen" size={16} color={tokens.section.pantry} />
              Pantry check
            </ButtonBase>
          </>
        )}
        <StoreActionsMenu
          onImport={onImport}
          onPantryCheck={onPantryCheck}
          onHistory={onHistory}
          onShare={onShare}
          onRename={onRename}
          onDelete={onDelete}
          canLeave={canLeave}
          onLeave={onLeave}
          loadingPantryCheck={loadingPantryCheck}
          includeImportPantry={isMobile}
        />
      </Box>

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
      <Box sx={{ mt: 1.5 }}>
        <AddItemRow onClick={onAddItem} />
      </Box>
    </Box>
  );

  const finishBar = (
    <FinishShopBar boughtCount={checkedCount} onFinish={() => setConfirmOpen(true)} />
  );

  const finishConfirm = (
    <FinishShopConfirm
      open={confirmOpen}
      variant={isMobile ? 'sheet' : 'dialog'}
      storeName={activeStore?.name ?? ''}
      boughtCount={checkedCount}
      remainingCount={remainingCount}
      onConfirm={() => {
        setConfirmOpen(false);
        onFinish();
      }}
      onCancel={() => setConfirmOpen(false)}
    />
  );

  if (isDesktop) {
    return (
      <>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '280px 1fr',
            minHeight: 0,
            position: 'relative',
          }}
        >
          {renderSidebar(false)}
          <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>{pane}</Box>
          {finishBar}
        </Box>
        {finishConfirm}
      </>
    );
  }

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
        {pane}
        {finishBar}
        {/* Sidebar kept rendered (off-screen) on mobile for selection parity and
            deep-link restore; the page's StoreListView is the visible mobile
            index. Off-screen positioning keeps the rows clickable/queryable. */}
        <Box aria-hidden={false} sx={{ position: 'absolute', left: -10000, top: 0, width: 280 }}>
          {renderSidebar(true)}
        </Box>
      </Box>
      {finishConfirm}
    </>
  );
}
