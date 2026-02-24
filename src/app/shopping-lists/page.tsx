'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import {
  Container,
  Typography,
  Box,
  Skeleton,
  CircularProgress,
  Paper,
  Button,
  Dialog,
  DialogContent,
  TextField,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  Divider,
  Autocomplete,
  Alert,
  Snackbar,
  Chip,
} from '@mui/material';
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  ShoppingCart,
  Add,
  DragIndicator,
  Edit,
  Delete,
  Share,
  Check,
  Close as CloseIcon,
  PersonAdd,
  Kitchen,
  MoreVert,
  Refresh,
  DoneAll,
  History,
} from '@mui/icons-material';
import AuthenticatedLayout from '../../components/AuthenticatedLayout';
import {
  StoreWithShoppingList,
  ShoppingListItem,
  PurchaseHistoryRecord,
} from '../../types/shopping-list';
import {
  fetchStores,
  createStore,
  updateStore,
  deleteStore,
  updateShoppingList,
  inviteUserToStore,
  respondToInvitation,
  removeUserFromStore,
  fetchPendingInvitations,
  fetchShoppingList,
  finishShop,
  fetchPurchaseHistory,
} from '../../lib/shopping-list-utils';
import {
  useDialog,
  useConfirmDialog,
  useSearchPagination,
  useShoppingSync,
  usePersistentDialog,
  type ActiveUser,
} from '@/lib/hooks';
import dynamic from 'next/dynamic';
const EmojiPicker = dynamic(() => import('../../components/EmojiPicker'), { ssr: false });
const StoreHistoryDialog = dynamic(
  () => import('../../components/shopping-list/StoreHistoryDialog'),
  { ssr: false }
);
import { DialogTitle } from '../../components/ui/DialogTitle';
import { DialogActions } from '../../components/ui/DialogActions';
import { ListRow, StaggeredList } from '@/components/ui';
import { responsiveDialogStyle } from '@/lib/theme';
import SearchBar from '@/components/optimized/SearchBar';
import Pagination from '@/components/optimized/Pagination';
import { getUnitOptions, getUnitForm } from '../../lib/food-items-utils';
import { MealPlanWithTemplate } from '../../types/meal-plan';
import { fetchMealPlans } from '../../lib/meal-plan-utils';
import {
  extractFoodItemsFromMealPlans,
  combineExtractedItems,
  UnitConflict,
  PreMergeConflict,
} from '../../lib/meal-plan-to-shopping-list';
import {
  saveItemPositions,
  getItemPosition,
  insertItemAtPosition,
  insertItemsWithPositions,
} from '../../lib/shopping-list-position-utils';
import { CalendarMonth } from '@mui/icons-material';
import { fetchPantryItems } from '../../lib/pantry-utils';
import QuantityInput from '../../components/food-item-inputs/QuantityInput';
import ItemEditorDialog, {
  type ItemEditorDraft,
  type ItemEditorMode,
} from '@/components/shopping-list/ItemEditorDialog';

interface FoodItem {
  _id: string;
  name: string;
  singularName: string;
  pluralName: string;
  unit: string;
}

// ── Shopping accent color ──
const SHOPPING_ACCENT = '#6baf7b';

function ShoppingListsPageContent() {
  const { status } = useSession();
  const { data: session } = useSession();
  const [stores, setStores] = useState<StoreWithShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<StoreWithShoppingList | null>(null);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<
    Array<{
      storeId: string;
      storeName: string;
      storeEmoji?: string;
      invitation: {
        userId: string;
        userEmail: string;
        status: 'pending';
        invitedBy: string;
        invitedAt: Date;
      };
    }>
  >([]);

  // Search and pagination
  const storePagination = useSearchPagination<StoreWithShoppingList>({
    data: stores,
    itemsPerPage: 25,
    searchFunction: (store, term) => store.name.toLowerCase().includes(term.toLowerCase()),
  });

  // Dialog states
  const createStoreDialog = useDialog();
  const editStoreDialog = useDialog();
  const viewListDialog = usePersistentDialog('shoppingList');
  const deleteConfirmDialog = useConfirmDialog();
  const emojiPickerDialog = useDialog();
  const mealPlanSelectionDialog = useDialog();
  const unitConflictDialog = useDialog();
  const shareDialog = useDialog();
  const leaveStoreConfirmDialog = useConfirmDialog();
  const pantryCheckDialog = useDialog();

  // Auto-focus refs for dialog inputs
  const storeNameRef = useRef<HTMLInputElement>(null);
  const shareEmailRef = useRef<HTMLInputElement>(null);

  // Notification state
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  const showSnackbar = (
    message: string,
    severity: 'success' | 'error' | 'info' | 'warning' = 'info'
  ) => {
    setSnackbar({ open: true, message, severity });
  };

  const lastManualReconnectAtRef = useRef<number>(0);
  const handleManualReconnect = () => {
    const now = Date.now();
    // Prevent spam-clicking from hammering Ably.
    if (now - lastManualReconnectAtRef.current < 1000) {
      return;
    }
    lastManualReconnectAtRef.current = now;
    void shoppingSync.reconnect();
    showSnackbar('Reconnecting…', 'info');
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Form states
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreEmoji, setNewStoreEmoji] = useState('🏪');
  const [editingStore, setEditingStore] = useState<StoreWithShoppingList | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [sharingStore, setSharingStore] = useState<StoreWithShoppingList | null>(null);

  // Shopping list states
  const [shoppingListItems, setShoppingListItems] = useState<ShoppingListItem[]>([]);

  // Scroll container for shopping list items
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const [listActionsAnchorEl, setListActionsAnchorEl] = useState<null | HTMLElement>(null);
  const [itemEditorMode, setItemEditorMode] = useState<ItemEditorMode>('add');
  const [itemEditorOpen, setItemEditorOpen] = useState(false);
  const [itemEditorInitialDraft, setItemEditorInitialDraft] = useState<ItemEditorDraft | null>(
    null
  );
  const [editingOriginalFoodItemId, setEditingOriginalFoodItemId] = useState<string | null>(null);

  // Meal plan import states
  const [availableMealPlans, setAvailableMealPlans] = useState<MealPlanWithTemplate[]>([]);
  const [selectedMealPlanIds, setSelectedMealPlanIds] = useState<string[]>([]);
  const [unitConflicts, setUnitConflicts] = useState<UnitConflict[]>([]);
  const [currentConflictIndex, setCurrentConflictIndex] = useState(0);
  const [conflictResolutions, setConflictResolutions] = useState<
    Map<string, { quantity: number; unit: string }>
  >(new Map());
  const [pendingMergedItems, setPendingMergedItems] = useState<ShoppingListItem[]>([]);

  // Pantry check states
  const [matchingPantryItems, setMatchingPantryItems] = useState<
    Array<{
      foodItemId: string;
      name: string;
      currentQuantity: number;
      unit: string;
      checked: boolean;
      newQuantity: number;
    }>
  >([]);
  const [loadingPantryCheck, setLoadingPantryCheck] = useState(false);

  // Purchase history states
  const [historyDialogStore, setHistoryDialogStore] = useState<StoreWithShoppingList | null>(null);
  const [historyItems, setHistoryItems] = useState<PurchaseHistoryRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);

  // Shopping Sync SSE connection
  const shoppingSync = useShoppingSync({
    storeId: selectedStore?._id || null,
    enabled: viewListDialog.open,
    presenceUser: session?.user?.email
      ? {
          email: session.user.email,
          name: (session.user as { name?: string })?.name || session.user.email,
        }
      : null,
    onPresenceUpdate: (users) => {
      setActiveUsers(users.filter((u) => u.email !== session?.user?.email));
    },
    onItemChecked: (foodItemId, checked) => {
      // Remote toggle: update the local state for that item
      setShoppingListItems((prev) =>
        prev.map((item) => (item.foodItemId === foodItemId ? { ...item, checked } : item))
      );
    },
    onListUpdated: (items) => {
      // Merge: keep local checked state, but accept structural/other changes from server
      setShoppingListItems((prev) => {
        const newItems = items as ShoppingListItem[];

        // Index current items by foodItemId for quick lookup
        const currentById = new Map(prev.map((item) => [item.foodItemId, item]));

        return newItems.map((newItem) => {
          const current = currentById.get(newItem.foodItemId);
          if (!current) {
            // New item - trust server state
            return newItem;
          }

          // Preserve local checked state, but accept other fields from server
          return { ...newItem, checked: current.checked };
        });
      });
    },
    onItemDeleted: (foodItemId, updatedBy) => {
      setShoppingListItems((prev) => prev.filter((item) => item.foodItemId !== foodItemId));
      showSnackbar(`${updatedBy} removed an item from the list`, 'info');
    },
  });

  // NOTE: Polling-based sync was temporarily used as a fallback while SSE reliability
  // was being improved. With Redis-backed SSE broadcasting in place, this polling
  // effect is disabled to allow testing pure real-time behavior.

  // Lazy-load food items on demand (not at page load)
  const foodItemsLoadedRef = useRef(false);
  const loadFoodItems = useCallback(async () => {
    if (foodItemsLoadedRef.current && foodItems.length > 0) return foodItems;
    try {
      const res = await fetch('/api/food-items?limit=1000');
      const json = await res.json();
      const items: FoodItem[] = Array.isArray(json) ? json : json.data || [];
      setFoodItems(items);
      foodItemsLoadedRef.current = true;
      return items;
    } catch (error) {
      console.error('Error loading food items:', error);
      return [];
    }
  }, [foodItems]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [storesData, invitationsData] = await Promise.all([
        fetchStores(),
        fetchPendingInvitations(),
      ]);
      setStores(storesData);
      setPendingInvitations(invitationsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      loadData();
    }
  }, [status, loadData]);

  useEffect(() => {
    if (!viewListDialog.open) {
      setListActionsAnchorEl(null);
    }
  }, [viewListDialog.open]);

  const handleOpenListActionsMenu = (event: React.MouseEvent<HTMLElement>) => {
    setListActionsAnchorEl(event.currentTarget);
  };

  const handleCloseListActionsMenu = () => {
    setListActionsAnchorEl(null);
  };

  const handleCreateStore = async () => {
    if (!newStoreName.trim()) return;

    try {
      await createStore({ name: newStoreName.trim(), emoji: newStoreEmoji });
      setNewStoreName('');
      setNewStoreEmoji('🏪');
      createStoreDialog.closeDialog();
      loadData();
    } catch (error) {
      console.error('Error creating store:', error);
      showSnackbar('Failed to create store', 'error');
    }
  };

  const handleEditStore = (store: StoreWithShoppingList) => {
    setEditingStore(store);
    setNewStoreName(store.name);
    setNewStoreEmoji(store.emoji || '🏪');
    editStoreDialog.openDialog();
  };

  const handleUpdateStore = async () => {
    if (!editingStore || !newStoreName.trim()) return;

    try {
      await updateStore(editingStore._id, {
        name: newStoreName.trim(),
        emoji: newStoreEmoji,
      });
      setNewStoreName('');
      setNewStoreEmoji('🏪');
      setEditingStore(null);
      editStoreDialog.closeDialog();
      loadData();
    } catch (error) {
      console.error('Error updating store:', error);
      showSnackbar('Failed to update store', 'error');
    }
  };

  const handleDeleteStore = async () => {
    if (!selectedStore) return;

    try {
      const result = await deleteStore(selectedStore._id);
      // Check if there were shared users (returned from API)
      if (result.sharedUserCount && result.sharedUserCount > 0) {
        console.log(`Store was shared with ${result.sharedUserCount} user(s)`);
      }
      deleteConfirmDialog.closeDialog();
      viewListDialog.closeDialog();
      setSelectedStore(null);
      loadData();
    } catch (error) {
      console.error('Error deleting store:', error);
      showSnackbar('Failed to delete store', 'error');
    }
  };

  // Sharing handlers
  const handleOpenShareDialog = async (store: StoreWithShoppingList) => {
    // Refresh data to get latest invitation status
    await loadData();

    // Find the updated store from the refreshed data
    const updatedStores = await fetchStores();
    const updatedStore = updatedStores.find((s) => s._id === store._id);

    setSharingStore(updatedStore || store);
    setShareEmail('');
    shareDialog.openDialog();
  };

  const handleInviteUser = async () => {
    if (!sharingStore || !shareEmail.trim()) return;

    try {
      await inviteUserToStore(sharingStore._id, shareEmail.trim());
      setShareEmail('');
      showSnackbar(`Invitation sent to ${shareEmail}`, 'success');

      // Refresh data and update the sharing store to show new invitation
      await loadData();
      const updatedStores = await fetchStores();
      const updatedStore = updatedStores.find((s) => s._id === sharingStore._id);
      if (updatedStore) {
        setSharingStore(updatedStore);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to invite user';
      showSnackbar(message, 'error');
    }
  };

  const handleAcceptInvitation = async (storeId: string, userId: string) => {
    try {
      await respondToInvitation(storeId, userId, 'accept');
      loadData();
    } catch (error) {
      console.error('Error accepting invitation:', error);
      showSnackbar('Failed to accept invitation', 'error');
    }
  };

  const handleRejectInvitation = async (storeId: string, userId: string) => {
    try {
      await respondToInvitation(storeId, userId, 'reject');
      loadData();
    } catch (error) {
      console.error('Error rejecting invitation:', error);
      showSnackbar('Failed to reject invitation', 'error');
    }
  };

  const handleRemoveUser = async (storeId: string, userId: string) => {
    try {
      await removeUserFromStore(storeId, userId);

      // Refresh data and update the sharing store to show updated list
      await loadData();
      if (sharingStore && sharingStore._id === storeId) {
        const updatedStores = await fetchStores();
        const updatedStore = updatedStores.find((s) => s._id === storeId);
        if (updatedStore) {
          setSharingStore(updatedStore);
        }
      }
    } catch (error) {
      console.error('Error removing user:', error);
      showSnackbar('Failed to remove user', 'error');
    }
  };

  const handleLeaveStore = (store: StoreWithShoppingList) => {
    setSelectedStore(store);
    leaveStoreConfirmDialog.openDialog();
  };

  const confirmLeaveStore = async () => {
    const userId = session?.user?.id;
    if (!userId || !selectedStore) return;

    try {
      await removeUserFromStore(selectedStore._id, userId);
      leaveStoreConfirmDialog.closeDialog();
      setSelectedStore(null);
      loadData();
      showSnackbar(`Left "${selectedStore.name}"`, 'info');
    } catch (error) {
      console.error('Error leaving store:', error);
      showSnackbar('Failed to leave store', 'error');
    }
  };

  const isStoreOwner = (store: StoreWithShoppingList): boolean => {
    const userId = session?.user?.id;
    return store.userId === userId;
  };

  const handleViewList = async (store: StoreWithShoppingList) => {
    setSelectedStore(store);
    viewListDialog.openDialog({ storeId: store._id });

    try {
      const list = await fetchShoppingList(store._id);
      setShoppingListItems(list.items || []);
    } catch (error) {
      console.error('Error loading shopping list:', error);
      showSnackbar('Failed to load latest shopping list', 'error');
      setShoppingListItems([]);
    }
  };

  const handleStartShopping = async (store: StoreWithShoppingList) => {
    // No separate Shop Mode anymore: open the same unified list.
    await handleViewList(store);
  };

  // Stable storeId extracted from dialog data to avoid re-fetching when
  // the data object reference changes but the value stays the same.
  const dialogStoreId = viewListDialog.data?.storeId;

  // Restore selected store and mode from URL when dialog is open
  useEffect(() => {
    if (!viewListDialog.open) return;
    if (!dialogStoreId) return;

    const store = stores.find((s) => s._id === dialogStoreId);
    if (!store) {
      return;
    }

    setSelectedStore(store);

    // Always re-fetch the latest list when entering the dialog (including refresh)
    const loadLatestList = async () => {
      try {
        const list = await fetchShoppingList(store._id);
        setShoppingListItems(list.items || []);
      } catch (error) {
        console.error('Error loading shopping list:', error);
        showSnackbar('Failed to load latest shopping list', 'error');
        setShoppingListItems([]);
      }
    };

    void loadLatestList();
  }, [viewListDialog.open, dialogStoreId, stores]);

  const handleEmojiSelect = (emoji: string) => {
    setNewStoreEmoji(emoji);
  };

  const handleOpenAddItemEditor = () => {
    setItemEditorMode('add');
    setItemEditorInitialDraft(null);
    setEditingOriginalFoodItemId(null);
    setItemEditorOpen(true);
  };

  const handleOpenEditItemEditor = (item: ShoppingListItem) => {
    setItemEditorMode('edit');
    setItemEditorInitialDraft({
      foodItemId: item.foodItemId,
      quantity: item.quantity,
      unit: item.unit,
    });
    setEditingOriginalFoodItemId(item.foodItemId);
    setItemEditorOpen(true);
  };

  const resolveNameForFoodItemId = async (foodItemId: string, qty: number): Promise<string> => {
    const foodItem = foodItems.find((f) => f._id === foodItemId);
    if (foodItem) {
      return qty === 1 ? foodItem.singularName : foodItem.pluralName;
    }
    // Fallback: fetch the individual food item
    try {
      const res = await fetch(`/api/food-items/${foodItemId}`);
      if (res.ok) {
        const item = await res.json();
        return qty === 1 ? item.singularName : item.pluralName;
      }
    } catch {
      /* ignore */
    }
    return 'Unknown';
  };

  const handleSaveItemFromEditor = async (draft: ItemEditorDraft) => {
    if (!selectedStore) return;

    const { foodItemId, quantity: qty, unit } = draft;

    if (itemEditorMode === 'add') {
      const exists = shoppingListItems.some((i) => i.foodItemId === foodItemId);
      if (exists) {
        showSnackbar('This item is already in your shopping list', 'warning');
        return;
      }

      const newItem: ShoppingListItem = {
        foodItemId,
        name: await resolveNameForFoodItemId(foodItemId, qty),
        quantity: qty,
        unit,
        checked: false,
      };

      const rememberedPosition = await getItemPosition(selectedStore._id, foodItemId);
      const updatedItems = insertItemAtPosition(shoppingListItems, newItem, rememberedPosition);

      setShoppingListItems(updatedItems);
      try {
        await updateShoppingList(selectedStore._id, { items: updatedItems });
        const updatedStores = await fetchStores();
        setStores(updatedStores);
        setItemEditorOpen(false);
      } catch (error) {
        console.error('Error saving shopping list:', error);
        showSnackbar('Failed to save item to shopping list', 'error');
        setShoppingListItems(shoppingListItems);
      }

      return;
    }

    // edit mode
    if (!editingOriginalFoodItemId) return;

    const previousItems = [...shoppingListItems];
    const existingItem = previousItems.find((i) => i.foodItemId === editingOriginalFoodItemId);
    if (!existingItem) return;

    if (foodItemId !== editingOriginalFoodItemId) {
      const wouldDuplicate = previousItems.some((i) => i.foodItemId === foodItemId);
      if (wouldDuplicate) {
        showSnackbar('That item is already in your shopping list', 'warning');
        return;
      }
    }

    const resolvedName = await resolveNameForFoodItemId(foodItemId, qty);
    const updatedItems = previousItems.map((i) => {
      if (i.foodItemId !== editingOriginalFoodItemId) return i;
      return {
        ...i,
        foodItemId,
        quantity: qty,
        unit,
        name: resolvedName,
      };
    });

    setShoppingListItems(updatedItems);
    try {
      await updateShoppingList(selectedStore._id, { items: updatedItems });
      const updatedStores = await fetchStores();
      setStores(updatedStores);
      setItemEditorOpen(false);
    } catch (error) {
      console.error('Error saving shopping list:', error);
      showSnackbar('Failed to save item to shopping list', 'error');
      setShoppingListItems(previousItems);
    }
  };

  const handleDeleteItemFromEditor = async () => {
    if (!editingOriginalFoodItemId) return;
    await handleRemoveItemFromList(editingOriginalFoodItemId);
    setItemEditorOpen(false);
  };

  const handleRemoveItemFromList = async (foodItemId: string) => {
    if (!selectedStore) return;

    const updatedItems = shoppingListItems.filter((item) => item.foodItemId !== foodItemId);
    setShoppingListItems(updatedItems);

    // Auto-save to database
    try {
      await updateShoppingList(selectedStore._id, { items: updatedItems });
      // Refresh the stores list to update item count
      const updatedStores = await fetchStores();
      setStores(updatedStores);
    } catch (error) {
      console.error('Error saving shopping list:', error);
      showSnackbar('Failed to remove item from shopping list', 'error');
      // Revert on error
      setShoppingListItems(shoppingListItems);
    }
  };

  const handleToggleItemChecked = async (foodItemId: string) => {
    if (!selectedStore) return;

    // Optimistic update
    const previousItems = [...shoppingListItems];
    setShoppingListItems(
      shoppingListItems.map((item) =>
        item.foodItemId === foodItemId ? { ...item, checked: !item.checked } : item
      )
    );

    try {
      const response = await fetch(
        `/api/shopping-lists/${selectedStore._id}/items/${foodItemId}/toggle`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        // Revert on error
        setShoppingListItems(previousItems);

        const errorData = await response.json();
        if (response.status === 404) {
          // Item was deleted by another user
          showSnackbar('This item was already removed from the list', 'warning');
          // Refresh the list
          try {
            const list = await fetchShoppingList(selectedStore._id);
            setShoppingListItems(list.items || []);
          } catch {
            setShoppingListItems([]);
          }
        } else {
          showSnackbar(errorData.error || 'Failed to update item', 'error');
        }
      }
    } catch (error) {
      // Revert on error
      setShoppingListItems(previousItems);
      console.error('Error toggling item checked:', error);
      showSnackbar('Failed to update item', 'error');
    }
  };

  const handleClearCheckedItems = async () => {
    if (!selectedStore) return;
    const checkedItems = shoppingListItems.filter((i) => i.checked);
    if (checkedItems.length === 0) return;

    const previousItems = [...shoppingListItems];
    const uncheckedItems = shoppingListItems.filter((i) => !i.checked);

    setShoppingListItems(uncheckedItems);

    try {
      await finishShop(
        selectedStore._id,
        checkedItems.map((i) => ({
          foodItemId: i.foodItemId,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
        }))
      );
      // Refresh counts/badges on the store list
      const updatedStores = await fetchStores();
      setStores(updatedStores);
      showSnackbar('Shopping trip saved!', 'success');
    } catch (error) {
      console.error('Error finishing shop:', error);
      showSnackbar('Failed to finish shop', 'error');
      setShoppingListItems(previousItems);
    }
  };

  // Purchase history handlers
  const handleOpenHistory = async (store: StoreWithShoppingList) => {
    setHistoryDialogStore(store);
    setLoadingHistory(true);
    try {
      const items = await fetchPurchaseHistory(store._id);
      setHistoryItems(items);
    } catch (error) {
      console.error('Error loading purchase history:', error);
      showSnackbar('Failed to load purchase history', 'error');
      setHistoryItems([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCloseHistory = () => {
    setHistoryDialogStore(null);
    setHistoryItems([]);
  };

  const handleAddHistoryItems = async (
    items: Array<{ foodItemId: string; name: string; quantity: number; unit: string }>
  ) => {
    const store = selectedStore || historyDialogStore;
    if (!store) return;

    // Use live shopping list items when available
    const currentItems = selectedStore?._id === store._id ? shoppingListItems : [];

    const newItems = items.filter(
      (item) => !currentItems.some((i) => i.foodItemId === item.foodItemId)
    );
    if (newItems.length === 0) {
      showSnackbar('All selected items are already in your list', 'info');
      return;
    }

    const newListItems: ShoppingListItem[] = newItems.map((item) => ({
      foodItemId: item.foodItemId,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      checked: false,
    }));

    const mergedItems = await insertItemsWithPositions(currentItems, newListItems, store._id);

    try {
      await updateShoppingList(store._id, { items: mergedItems });
      const updatedStores = await fetchStores();
      setStores(updatedStores);
      // If the shopping list dialog is open for this store, update its items too
      if (selectedStore?._id === store._id) {
        setShoppingListItems(mergedItems);
      }
      showSnackbar(
        `Added ${newItems.length} item${newItems.length > 1 ? 's' : ''} from history`,
        'success'
      );
    } catch (error) {
      console.error('Error adding items from history:', error);
      showSnackbar('Failed to add items from history', 'error');
    }
  };

  // Meal plan import handlers
  const handleOpenMealPlanSelection = async () => {
    try {
      // Start loading food items in parallel with meal plans
      void loadFoodItems();
      const allMealPlans = await fetchMealPlans();

      // Filter meal plans: last 3 days or future
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const filtered = allMealPlans.filter((mp) => {
        const startDate = new Date(mp.startDate);
        return startDate >= threeDaysAgo || startDate >= today;
      });

      setAvailableMealPlans(filtered);
      setSelectedMealPlanIds([]);
      mealPlanSelectionDialog.openDialog();
    } catch (error) {
      console.error('Error loading meal plans:', error);
      showSnackbar('Failed to load meal plans', 'error');
    }
  };

  const handleAddItemsFromMealPlans = async () => {
    if (!selectedStore) return;

    mealPlanSelectionDialog.closeDialog();

    try {
      // Get selected meal plans
      const selectedPlans = availableMealPlans.filter((mp) => selectedMealPlanIds.includes(mp._id));

      // Extract food items from meal plans
      const extractedItems = await extractFoodItemsFromMealPlans(selectedPlans);

      // Ensure food items are loaded for name/unit lookup
      const loadedFoodItems = await loadFoodItems();

      // Convert existing shopping list items to ExtractedItem format
      const existingAsExtracted = shoppingListItems.map((item) => ({
        foodItemId: item.foodItemId,
        quantity: item.quantity,
        unit: item.unit,
      }));

      // Unified pre-merge: combine existing + extracted items together.
      // This produces at most one conflict per food item.
      const { combinedItems, conflicts: preMergeConflicts } = combineExtractedItems([
        ...existingAsExtracted,
        ...extractedItems,
      ]);

      // Create food items map for name lookup
      const foodItemsMap = new Map(
        loadedFoodItems.map((f) => [
          f._id,
          {
            singularName: f.singularName,
            pluralName: f.pluralName,
            unit: f.unit,
          },
        ])
      );

      // Fetch names for conflict food items missing from the map
      const missingConflictIds = preMergeConflicts
        .filter((c: PreMergeConflict) => !foodItemsMap.has(c.foodItemId))
        .map((c: PreMergeConflict) => c.foodItemId);

      if (missingConflictIds.length > 0) {
        const missingItems = await Promise.all(
          missingConflictIds.map(async (id) => {
            try {
              const res = await fetch(`/api/food-items/${id}`);
              if (res.ok) return await res.json();
            } catch {
              /* ignore */
            }
            return null;
          })
        );
        for (const item of missingItems) {
          if (item) {
            foodItemsMap.set(item._id, {
              singularName: item.singularName,
              pluralName: item.pluralName,
              unit: item.unit,
            });
          }
        }
      }

      // Track which food items had extracted counterparts
      const extractedFoodItemIds = new Set(extractedItems.map((i) => i.foodItemId));

      // Convert combinedItems to ShoppingListItem format
      const mergedItems: ShoppingListItem[] = combinedItems.map((item) => {
        const foodItem = foodItemsMap.get(item.foodItemId);
        const existingItem = shoppingListItems.find((si) => si.foodItemId === item.foodItemId);

        // Preserve checked status for items that weren't modified by extraction
        const wasModified = extractedFoodItemIds.has(item.foodItemId);

        return {
          foodItemId: item.foodItemId,
          name: foodItem
            ? item.quantity === 1
              ? foodItem.singularName
              : foodItem.pluralName
            : existingItem?.name || 'Unknown',
          quantity: item.quantity,
          unit: item.unit,
          checked: wasModified ? false : (existingItem?.checked ?? false),
        };
      });

      // Convert pre-merge conflicts to UnitConflict format for dialog
      const conflicts: UnitConflict[] = preMergeConflicts.map((conflict: PreMergeConflict) => {
        const foodItem = foodItemsMap.get(conflict.foodItemId);
        return {
          foodItemId: conflict.foodItemId,
          foodItemName: foodItem?.pluralName || 'Unknown',
          existingQuantity: conflict.unitBreakdown[0].quantity,
          existingUnit: conflict.unitBreakdown[0].unit,
          newQuantity: conflict.unitBreakdown.slice(1).reduce((sum, e) => sum + e.quantity, 0),
          newUnit: conflict.unitBreakdown[1]?.unit || conflict.unitBreakdown[0].unit,
          isAutoConverted: conflict.isAutoConverted,
          suggestedQuantity: conflict.suggestedQuantity,
          suggestedUnit: conflict.suggestedUnit,
          unitBreakdown: conflict.unitBreakdown,
        };
      });

      // Separate existing items from new items for position-aware insertion
      const existingItemIds = new Set(shoppingListItems.map((item) => item.foodItemId));
      const existingItems = mergedItems.filter((item) => existingItemIds.has(item.foodItemId));
      const newItems = mergedItems.filter((item) => !existingItemIds.has(item.foodItemId));

      // Insert new items at their remembered positions
      const itemsWithPositions = await insertItemsWithPositions(
        existingItems,
        newItems,
        selectedStore._id
      );

      if (conflicts.length > 0) {
        // Has unit conflicts - store pending items, show dialog
        // Do NOT update shoppingListItems until deconfliction is complete
        setPendingMergedItems(itemsWithPositions);
        setUnitConflicts(conflicts);
        setCurrentConflictIndex(0);
        setConflictResolutions(new Map());
        unitConflictDialog.openDialog();
      } else {
        // No conflicts - save directly
        setShoppingListItems(itemsWithPositions);
        await updateShoppingList(selectedStore._id, {
          items: itemsWithPositions,
        });
        // Refresh stores list
        const updatedStores = await fetchStores();
        setStores(updatedStores);
        setSelectedMealPlanIds([]);
      }
    } catch (error) {
      console.error('Error adding items from meal plans:', error);
      showSnackbar('Failed to add items from meal plans', 'error');
    }
  };

  const getCurrentConflictResolution = (): {
    quantity: number;
    unit: string;
  } => {
    if (unitConflicts.length === 0) return { quantity: 1, unit: 'piece' };

    const conflict = unitConflicts[currentConflictIndex];
    const existing = conflictResolutions.get(conflict?.foodItemId);

    if (existing) return existing;

    // For auto-converted conflicts, default to suggested values
    if (
      conflict?.isAutoConverted &&
      conflict.suggestedQuantity !== undefined &&
      conflict.suggestedUnit
    ) {
      return {
        quantity: Math.round(conflict.suggestedQuantity * 100) / 100,
        unit: conflict.suggestedUnit,
      };
    }

    // Non-convertible conflicts start blank — user must choose
    return {
      quantity: 0,
      unit: '',
    };
  };

  const isCurrentConflictResolved = (): boolean => {
    if (unitConflicts.length === 0) return true;

    const conflict = unitConflicts[currentConflictIndex];

    // Auto-converted conflicts always have valid suggested defaults
    if (conflict?.isAutoConverted) return true;

    // Non-convertible: check that user has set both quantity and unit
    const resolution = getCurrentConflictResolution();
    return resolution.quantity > 0 && resolution.unit !== '';
  };

  const handleConflictQuantityChange = (quantity: number) => {
    if (unitConflicts.length === 0) return;

    const conflict = unitConflicts[currentConflictIndex];
    const current = getCurrentConflictResolution();
    const newResolutions = new Map(conflictResolutions);
    newResolutions.set(conflict.foodItemId, { quantity, unit: current.unit });
    setConflictResolutions(newResolutions);
  };

  const handleConflictUnitChange = (unit: string) => {
    if (unitConflicts.length === 0) return;

    const conflict = unitConflicts[currentConflictIndex];
    const current = getCurrentConflictResolution();
    const newResolutions = new Map(conflictResolutions);
    newResolutions.set(conflict.foodItemId, {
      quantity: current.quantity,
      unit,
    });
    setConflictResolutions(newResolutions);
  };

  const handleNextConflict = () => {
    if (currentConflictIndex < unitConflicts.length - 1) {
      setCurrentConflictIndex(currentConflictIndex + 1);
    } else {
      // All conflicts resolved - apply and save
      handleApplyConflictResolutions();
    }
  };

  const handlePreviousConflict = () => {
    if (currentConflictIndex > 0) {
      setCurrentConflictIndex(currentConflictIndex - 1);
    }
  };

  const handleApplyConflictResolutions = async () => {
    if (!selectedStore) return;

    // Build complete resolutions map including defaults for unmodified conflicts
    const completeResolutions = new Map(conflictResolutions);
    for (const conflict of unitConflicts) {
      if (!completeResolutions.has(conflict.foodItemId)) {
        if (
          conflict.isAutoConverted &&
          conflict.suggestedQuantity !== undefined &&
          conflict.suggestedUnit
        ) {
          completeResolutions.set(conflict.foodItemId, {
            quantity: Math.round(conflict.suggestedQuantity * 100) / 100,
            unit: conflict.suggestedUnit,
          });
        } else {
          completeResolutions.set(conflict.foodItemId, {
            quantity: conflict.existingQuantity,
            unit: conflict.existingUnit,
          });
        }
      }
    }

    // Apply resolutions to pending items (not yet on the shopping list)
    const updatedItems = pendingMergedItems.map((item) => {
      const resolution = completeResolutions.get(item.foodItemId);
      if (resolution) {
        const foodItem = foodItems.find((f) => f._id === item.foodItemId);
        return {
          ...item,
          quantity: resolution.quantity,
          unit: resolution.unit,
          name: foodItem
            ? resolution.quantity === 1
              ? foodItem.singularName
              : foodItem.pluralName
            : item.name,
        };
      }
      return item;
    });

    const previousItems = shoppingListItems;
    setShoppingListItems(updatedItems);

    try {
      await updateShoppingList(selectedStore._id, { items: updatedItems });
      // Refresh stores list
      const updatedStores = await fetchStores();
      setStores(updatedStores);
      unitConflictDialog.closeDialog();
      setSelectedMealPlanIds([]);
      setUnitConflicts([]);
      setCurrentConflictIndex(0);
      setConflictResolutions(new Map());
    } catch (error) {
      console.error('Error saving shopping list after conflict resolution:', error);
      showSnackbar('Failed to save shopping list', 'error');
      setShoppingListItems(previousItems);
    }
  };

  // Pantry Check Handlers
  const handleOpenPantryCheck = async () => {
    if (!selectedStore) return;

    try {
      setLoadingPantryCheck(true);

      // Load food items and pantry items in parallel
      const [pantryItems] = await Promise.all([fetchPantryItems(), loadFoodItems()]);

      // Find shopping list items that are in pantry
      const matches = shoppingListItems
        .filter((item) => pantryItems.some((p) => p.foodItemId === item.foodItemId))
        .map((item) => ({
          foodItemId: item.foodItemId,
          name: item.name,
          currentQuantity: item.quantity,
          unit: item.unit,
          checked: false,
          newQuantity: item.quantity,
        }));

      setMatchingPantryItems(matches);

      // Only open dialog after successful fetch and match
      pantryCheckDialog.openDialog();
    } catch (error) {
      console.error('Error loading pantry items:', error);
      showSnackbar('Failed to load pantry items', 'error');
    } finally {
      setLoadingPantryCheck(false);
    }
  };

  const handlePantryItemCheck = (foodItemId: string, checked: boolean) => {
    setMatchingPantryItems((prev) =>
      prev.map((item) => (item.foodItemId === foodItemId ? { ...item, checked } : item))
    );
  };

  const handlePantryItemQuantityChange = (foodItemId: string, newQuantity: number) => {
    setMatchingPantryItems((prev) =>
      prev.map((item) => (item.foodItemId === foodItemId ? { ...item, newQuantity } : item))
    );
  };

  const handleApplyPantryCheck = async () => {
    if (!selectedStore) return;

    try {
      // Apply changes from pantry check
      const updatedItems = shoppingListItems
        .map((item) => {
          const match = matchingPantryItems.find((m) => m.foodItemId === item.foodItemId);
          if (match) {
            // If checked off or quantity is 0, remove it (will be filtered out below)
            if (match.checked || match.newQuantity <= 0) {
              return null;
            }
            // Update quantity if changed
            if (match.newQuantity !== item.quantity) {
              const foodItem = foodItems.find((f) => f._id === item.foodItemId);
              const newName = foodItem
                ? match.newQuantity === 1
                  ? foodItem.singularName
                  : foodItem.pluralName
                : item.name;
              return { ...item, quantity: match.newQuantity, name: newName };
            }
          }
          return item;
        })
        .filter((item): item is ShoppingListItem => item !== null);

      setShoppingListItems(updatedItems);

      // Save to database
      await updateShoppingList(selectedStore._id, { items: updatedItems });

      // Refresh stores list
      const updatedStores = await fetchStores();
      setStores(updatedStores);

      pantryCheckDialog.closeDialog();
      setMatchingPantryItems([]);

      const removedCount = shoppingListItems.length - updatedItems.length;
      const changedCount = matchingPantryItems.filter(
        (m) => !m.checked && m.newQuantity !== m.currentQuantity
      ).length;

      if (removedCount > 0 || changedCount > 0) {
        showSnackbar(
          `Pantry check complete! ${
            removedCount > 0 ? `Removed ${removedCount} item(s). ` : ''
          }${changedCount > 0 ? `Updated ${changedCount} quantity(ies).` : ''}`,
          'success'
        );
      } else {
        showSnackbar('No changes made', 'info');
      }
    } catch (error) {
      console.error('Error applying pantry check:', error);
      showSnackbar('Failed to apply pantry check', 'error');
    }
  };

  const handleReorderUncheckedItems = useCallback(
    async (activeId: string, overId: string) => {
      if (!selectedStore || activeId === overId) return;

      const previousItems = [...shoppingListItems];
      const unchecked = previousItems.filter((i) => !i.checked);
      const checked = previousItems.filter((i) => i.checked);

      const fromIndex = unchecked.findIndex((i) => i.foodItemId === activeId);
      const toIndex = unchecked.findIndex((i) => i.foodItemId === overId);
      if (fromIndex === -1 || toIndex === -1) return;

      const newUnchecked = arrayMove(unchecked, fromIndex, toIndex);
      const updatedItems = [...newUnchecked, ...checked];

      setShoppingListItems(updatedItems);

      try {
        await updateShoppingList(selectedStore._id, { items: updatedItems });
        // Preserve “list position memory”
        await saveItemPositions(selectedStore._id, updatedItems);
      } catch (error) {
        console.error('Error reordering items:', error);
        showSnackbar('Failed to save new order', 'error');
        setShoppingListItems(previousItems);
      }
    },
    [selectedStore, shoppingListItems]
  );

  const dndSensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(TouchSensor, {
      // Long-press-ish feel, but still responsive
      activationConstraint: { delay: 150, tolerance: 8 },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    void handleReorderUncheckedItems(String(active.id), String(over.id));
  };

  const orderedShoppingItems = useMemo(() => {
    const unchecked = shoppingListItems.filter((i) => !i.checked);
    const checked = shoppingListItems.filter((i) => i.checked);
    return { unchecked, checked };
  }, [shoppingListItems]);

  const SortableShoppingListRow = ({
    item,
    isLast,
  }: {
    item: ShoppingListItem;
    isLast: boolean;
  }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: item.foodItemId,
    });

    return (
      <Box>
        <ListItem
          ref={setNodeRef}
          disableGutters
          secondaryAction={
            <IconButton
              edge="end"
              aria-label="Reorder"
              size="small"
              {...attributes}
              {...listeners}
              sx={{ touchAction: 'none' }}
            >
              <DragIndicator fontSize="small" />
            </IconButton>
          }
          sx={{
            px: 1,
            py: 0.25,
            transform: CSS.Transform.toString(transform),
            transition,
            opacity: isDragging ? 0.6 : 1,
            width: '100%',
            maxWidth: '100%',
            overflowX: 'hidden',
          }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <Checkbox
              checked={item.checked}
              onClick={(e) => {
                e.stopPropagation();
                void handleToggleItemChecked(item.foodItemId);
              }}
            />
          </ListItemIcon>
          <ListItemText
            primary={item.name}
            secondary={`${item.quantity} ${
              item.unit && item.unit !== 'each'
                ? getUnitForm(item.unit, item.quantity)
                : item.unit === 'each'
                  ? 'each'
                  : ''
            }`}
            onClick={() => handleOpenEditItemEditor(item)}
            sx={{
              cursor: 'pointer',
              textDecoration: item.checked ? 'line-through' : 'none',
              opacity: item.checked ? 0.6 : 1,
              pr: 4,
            }}
          />
        </ListItem>
        {!isLast && <Divider />}
      </Box>
    );
  };

  // Show loading state while session is being fetched
  if (status === 'loading') {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="xl">
          <Box sx={{ py: { xs: 0.5, md: 1 } }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: { xs: 1.5, md: 2 },
              }}
            >
              <Skeleton variant="text" width={160} height={28} />
              <Skeleton variant="rounded" width={100} height={32} />
            </Box>
            <Box sx={{ maxWidth: 'md', mx: 'auto' }}>
              <Skeleton variant="rounded" height={36} sx={{ mb: 2 }} />
              {[55, 65, 50, 70].map((w, i) => (
                <Box
                  key={i}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    minHeight: 40,
                    px: 1.5,
                    py: 1,
                    borderBottom: '1px solid',
                    borderBottomColor: 'divider',
                  }}
                >
                  <Skeleton variant="text" width={24} height={24} sx={{ mr: 1, flexShrink: 0 }} />
                  <Skeleton variant="text" width={`${w}%`} height={20} sx={{ flex: '1 1 auto' }} />
                  <Skeleton variant="text" width={40} height={16} sx={{ flexShrink: 0, ml: 1 }} />
                </Box>
              ))}
            </Box>
          </Box>
        </Container>
      </AuthenticatedLayout>
    );
  }

  // Only redirect if session is definitely not available
  if (status === 'unauthenticated') {
    redirect('/');
  }

  return (
    <AuthenticatedLayout>
      <Container maxWidth="xl">
        <Box sx={{ py: { xs: 0.5, md: 1 } }}>
          {/* Compact page header */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: { xs: 1.5, md: 2 },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShoppingCart sx={{ fontSize: { xs: 24, sm: 32 }, color: SHOPPING_ACCENT }} />
              <Typography
                variant="h5"
                component="h1"
                sx={{ fontSize: '1.125rem', fontWeight: 600 }}
              >
                Shopping Lists
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {/* Mobile: icon-only add button */}
              <IconButton
                onClick={createStoreDialog.openDialog}
                size="small"
                sx={{
                  display: { xs: 'flex', sm: 'none' },
                  bgcolor: SHOPPING_ACCENT,
                  color: 'white',
                  width: 32,
                  height: 32,
                  '&:hover': { bgcolor: '#5a9a69' },
                }}
              >
                <Add sx={{ fontSize: 18 }} />
              </IconButton>
              {/* Desktop: full add button */}
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={createStoreDialog.openDialog}
                size="small"
                sx={{
                  display: { xs: 'none', sm: 'flex' },
                  bgcolor: SHOPPING_ACCENT,
                  '&:hover': { bgcolor: '#5a9a69' },
                }}
              >
                Add Store
              </Button>
            </Box>
          </Box>

          {/* Pending Invitations Section */}
          {pendingInvitations.length > 0 && (
            <Box sx={{ mb: 2, maxWidth: 'md', mx: 'auto' }}>
              <Typography
                variant="h6"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'text.secondary',
                  mb: 1,
                }}
              >
                <PersonAdd sx={{ fontSize: 16 }} />
                Pending Invitations ({pendingInvitations.length})
              </Typography>
              <List>
                {pendingInvitations.map((inv) => (
                  <Box key={inv.storeId}>
                    <ListItem>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          flex: 1,
                        }}
                      >
                        <Typography variant="h6">{inv.storeEmoji}</Typography>
                        <ListItemText
                          primary={inv.storeName}
                          secondary={`Invited ${new Date(
                            inv.invitation.invitedAt
                          ).toLocaleDateString()}`}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton
                          color="success"
                          size="small"
                          title="Accept"
                          onClick={() => handleAcceptInvitation(inv.storeId, inv.invitation.userId)}
                        >
                          <Check fontSize="small" />
                        </IconButton>
                        <IconButton
                          color="error"
                          size="small"
                          title="Reject"
                          onClick={() => handleRejectInvitation(inv.storeId, inv.invitation.userId)}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </ListItem>
                    <Divider />
                  </Box>
                ))}
              </List>
            </Box>
          )}

          <Box sx={{ maxWidth: 'md', mx: 'auto' }}>
            <SearchBar
              value={storePagination.searchTerm}
              onChange={storePagination.setSearchTerm}
              placeholder="Search stores..."
            />

            {loading ? (
              <Box>
                {[55, 65, 50, 70].map((w, i) => (
                  <Box
                    key={i}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      minHeight: 40,
                      px: 1.5,
                      py: 1,
                      borderBottom: '1px solid',
                      borderBottomColor: 'divider',
                    }}
                  >
                    <Skeleton variant="text" width={24} height={24} sx={{ mr: 1, flexShrink: 0 }} />
                    <Skeleton variant="text" width={`${w}%`} height={20} sx={{ flex: '1 1 auto' }} />
                    <Skeleton variant="text" width={40} height={16} sx={{ flexShrink: 0, ml: 1 }} />
                  </Box>
                ))}
              </Box>
            ) : storePagination.paginatedData.length === 0 ? (
              <Alert severity="info">
                {storePagination.searchTerm
                  ? 'No stores match your search criteria'
                  : 'No stores yet. Add your first store to create shopping lists.'}
              </Alert>
            ) : (
              <>
                {/* Flat row store list — unified layout */}
                <StaggeredList>
                  {storePagination.paginatedData.map((store) => (
                    <ListRow
                      key={store._id}
                      onClick={() => handleViewList(store)}
                      accentColor={SHOPPING_ACCENT}
                      sx={{ minHeight: 40 }}
                    >
                      {/* Emoji */}
                      <Typography
                        sx={{
                          fontSize: '1.1rem',
                          lineHeight: 1,
                          flexShrink: 0,
                          width: 24,
                          textAlign: 'center',
                          mr: 1,
                        }}
                      >
                        {store.emoji}
                      </Typography>

                      {/* Name */}
                      <Typography
                        variant="body2"
                        sx={{
                          flex: '1 1 auto',
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontWeight: 500,
                        }}
                      >
                        {store.name}
                      </Typography>

                      {/* Item count */}
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ flexShrink: 0, fontSize: '0.75rem', mr: 1 }}
                      >
                        {store.shoppingList?.itemCount || 0}
                      </Typography>

                      {/* Action icons */}
                      <Box
                        sx={{
                          display: 'flex',
                          gap: 0.5,
                          alignItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconButton
                          size="small"
                          title="Start Shopping"
                          disabled={!store.shoppingList?.itemCount}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartShopping(store);
                          }}
                          sx={{ color: 'text.secondary', p: 0.5, '&:hover': { color: SHOPPING_ACCENT } }}
                        >
                          <ShoppingCart sx={{ fontSize: 16 }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          title="Purchase History"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenHistory(store);
                          }}
                          sx={{ color: 'text.secondary', p: 0.5, display: { xs: 'none', sm: 'flex' } }}
                        >
                          <History sx={{ fontSize: 16 }} />
                        </IconButton>

                        {isStoreOwner(store) ? (
                          <>
                            <IconButton
                              size="small"
                              title="Share Store"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenShareDialog(store);
                              }}
                              sx={{ color: 'text.secondary', p: 0.5, display: { xs: 'none', sm: 'flex' } }}
                            >
                              <Share sx={{ fontSize: 16 }} />
                            </IconButton>
                            <IconButton
                              size="small"
                              title="Edit Store"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditStore(store);
                              }}
                              sx={{ color: 'text.secondary', p: 0.5, display: { xs: 'none', sm: 'flex' } }}
                            >
                              <Edit sx={{ fontSize: 16 }} />
                            </IconButton>
                            <IconButton
                              size="small"
                              title="Delete Store"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStore(store);
                                deleteConfirmDialog.openDialog();
                              }}
                              sx={{ color: 'text.secondary', p: 0.5, '&:hover': { color: 'error.main' }, display: { xs: 'none', sm: 'flex' } }}
                            >
                              <Delete sx={{ fontSize: 16 }} />
                            </IconButton>
                          </>
                        ) : (
                          <IconButton
                            size="small"
                            title="Leave Store"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLeaveStore(store);
                            }}
                            sx={{ color: 'text.secondary', p: 0.5, '&:hover': { color: 'warning.main' }, display: { xs: 'none', sm: 'flex' } }}
                          >
                            <CloseIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        )}
                      </Box>
                    </ListRow>
                  ))}
                </StaggeredList>

                <Pagination
                  count={storePagination.totalPages}
                  page={storePagination.currentPage}
                  onChange={storePagination.setCurrentPage}
                  show={storePagination.totalPages > 1}
                />
              </>
            )}
          </Box>
        </Box>
      </Container>

      {/* Create Store Dialog */}
      <Dialog
        open={createStoreDialog.open}
        onClose={createStoreDialog.closeDialog}
        sx={responsiveDialogStyle}
        TransitionProps={{ onEntered: () => storeNameRef.current?.focus() }}
      >
        <DialogTitle onClose={createStoreDialog.closeDialog}>Add Store</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Store Icon
              </Typography>
              <Button
                variant="outlined"
                onClick={emojiPickerDialog.openDialog}
                sx={{
                  fontSize: '2rem',
                  minWidth: 80,
                  minHeight: 80,
                }}
              >
                {newStoreEmoji}
              </Button>
            </Box>
            <TextField
              label="Store Name"
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              fullWidth
              inputRef={storeNameRef}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && newStoreName.trim()) {
                  handleCreateStore();
                }
              }}
            />
          </Box>
          <DialogActions primaryButtonIndex={1}>
            <Button
              onClick={createStoreDialog.closeDialog}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateStore}
              variant="contained"
              disabled={!newStoreName.trim()}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Create Store
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>

      {/* Edit Store Dialog */}
      <Dialog
        open={editStoreDialog.open}
        onClose={editStoreDialog.closeDialog}
        sx={responsiveDialogStyle}
        TransitionProps={{ onEntered: () => storeNameRef.current?.focus() }}
      >
        <DialogTitle onClose={editStoreDialog.closeDialog}>Edit Store</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Store Icon
              </Typography>
              <Button
                variant="outlined"
                onClick={emojiPickerDialog.openDialog}
                sx={{
                  fontSize: '2rem',
                  minWidth: 80,
                  minHeight: 80,
                }}
              >
                {newStoreEmoji}
              </Button>
            </Box>
            <TextField
              label="Store Name"
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              fullWidth
              inputRef={storeNameRef}
            />
          </Box>
          <DialogActions primaryButtonIndex={1}>
            <Button
              onClick={editStoreDialog.closeDialog}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateStore}
              variant="contained"
              disabled={!newStoreName.trim()}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Update Store
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>

      {/* View/Edit Shopping List Dialog */}
      <Dialog
        open={viewListDialog.open}
        onClose={viewListDialog.closeDialog}
        maxWidth="md"
        fullWidth
        sx={{
          ...responsiveDialogStyle,
          '& .MuiDialog-paper': {
            ...(() => {
              const paper = (responsiveDialogStyle as Record<string, unknown>)[
                '& .MuiDialog-paper'
              ];
              return paper && typeof paper === 'object' ? (paper as Record<string, unknown>) : {};
            })(),
            // Only full-height/flex on mobile. Desktop should size to content.
            display: { xs: 'flex', sm: 'block' },
            flexDirection: { xs: 'column' },
          },
        }}
      >
        <DialogTitle
          onClose={viewListDialog.closeDialog}
          actions={
            <IconButton aria-label="More actions" onClick={handleOpenListActionsMenu} size="small">
              <MoreVert />
            </IconButton>
          }
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* Single-line header: emoji + name (ellipsis) + live pill */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                flexWrap: 'nowrap',
                minWidth: 0,
              }}
            >
              <Typography variant="h4" sx={{ flex: '0 0 auto' }}>
                {selectedStore?.emoji}
              </Typography>
              <Typography
                variant="h6"
                noWrap
                sx={{
                  flex: '1 1 auto',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {selectedStore?.name}
              </Typography>
              <Box
                role={shoppingSync.isConnected ? undefined : 'button'}
                onClick={shoppingSync.isConnected ? undefined : handleManualReconnect}
                sx={{
                  flex: '0 0 auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1,
                  py: 0.5,
                  mr: 1,
                  borderRadius: 1,
                  bgcolor: shoppingSync.isConnected
                    ? 'success.main'
                    : shoppingSync.connectionState === 'connecting'
                      ? 'warning.main'
                      : (theme) => (theme.palette.mode === 'dark' ? 'grey.700' : 'grey.300'),
                  color: shoppingSync.isConnected
                    ? 'success.contrastText'
                    : shoppingSync.connectionState === 'connecting'
                      ? 'warning.contrastText'
                      : (theme) => (theme.palette.mode === 'dark' ? 'grey.100' : 'grey.800'),
                  fontSize: '0.7rem',
                  whiteSpace: 'nowrap',
                  cursor: shoppingSync.isConnected ? 'default' : 'pointer',
                  userSelect: 'none',
                }}
                title={
                  shoppingSync.isConnected
                    ? 'Live'
                    : shoppingSync.connectionState === 'connecting'
                      ? 'Reconnecting…'
                      : 'Offline (tap to reconnect)'
                }
              >
                {shoppingSync.isConnected ? (
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: 'success.contrastText',
                    }}
                  />
                ) : (
                  <Refresh sx={{ fontSize: 14 }} />
                )}
                {shoppingSync.isConnected
                  ? 'Live'
                  : shoppingSync.connectionState === 'connecting'
                    ? 'Reconnecting'
                    : 'Offline'}
              </Box>
            </Box>

            {/* Secondary line can wrap: active viewers */}
            {activeUsers.length > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  flexWrap: 'wrap',
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Also viewing:
                </Typography>
                {activeUsers.map((user, index) => (
                  <Box
                    key={index}
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      fontSize: '0.75rem',
                    }}
                  >
                    {user.name}
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </DialogTitle>
        <Menu
          anchorEl={listActionsAnchorEl}
          open={Boolean(listActionsAnchorEl)}
          onClose={handleCloseListActionsMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem
            onClick={() => {
              handleCloseListActionsMenu();
              void handleOpenMealPlanSelection();
            }}
          >
            <ListItemIcon>
              <CalendarMonth fontSize="small" />
            </ListItemIcon>
            <ListItemText>Add items from meal plans</ListItemText>
          </MenuItem>
          <MenuItem
            disabled={loadingPantryCheck}
            onClick={() => {
              handleCloseListActionsMenu();
              void handleOpenPantryCheck();
            }}
          >
            <ListItemIcon>
              {loadingPantryCheck ? <CircularProgress size={16} /> : <Kitchen fontSize="small" />}
            </ListItemIcon>
            <ListItemText>Pantry check</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              handleCloseListActionsMenu();
              if (selectedStore) {
                void handleOpenHistory(selectedStore);
              }
            }}
          >
            <ListItemIcon>
              <History fontSize="small" />
            </ListItemIcon>
            <ListItemText>Purchase history</ListItemText>
          </MenuItem>
        </Menu>
        <DialogContent
          sx={{
            overflowX: 'hidden',
            // Only stretch on mobile. Desktop should size naturally.
            flex: { xs: 1, sm: 'initial' },
            minHeight: { xs: 0 },
            display: { xs: 'flex', sm: 'block' },
            flexDirection: { xs: 'column' },
          }}
        >
          <Box
            sx={{
              mt: 0,
              display: { xs: 'flex', sm: 'block' },
              flexDirection: { xs: 'column' },
              minHeight: { xs: 0 },
              flex: { xs: 1, sm: 'initial' },
            }}
          >
            {shoppingListItems.length === 0 ? (
              <>
                <Alert severity="info" sx={{ mb: 2 }}>
                  No items in this shopping list yet. Add an item to get started.
                </Alert>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={handleOpenAddItemEditor}
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                  >
                    Add item
                  </Button>
                </Box>
              </>
            ) : (
              <>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 2,
                  }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ flex: '1 1 auto', minWidth: 0 }}
                  >
                    Tap an item to edit it.
                  </Typography>
                  {orderedShoppingItems.checked.length > 0 && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="success"
                      startIcon={<DoneAll />}
                      onClick={() => void handleClearCheckedItems()}
                      sx={{ flex: '0 0 auto' }}
                    >
                      Finish Shop
                    </Button>
                  )}
                  <IconButton aria-label="Add item" onClick={handleOpenAddItemEditor} size="small">
                    <Add />
                  </IconButton>
                </Box>
                <Box
                  ref={listContainerRef}
                  sx={{
                    // Mobile: fill the dialog so no dead space.
                    // Desktop: keep the prior bounded list height.
                    flex: { xs: 1, sm: 'initial' },
                    minHeight: { xs: 0 },
                    // On desktop, use a fixed list region so the dialog doesn't
                    // keep growing as items are added; the list itself scrolls.
                    height: { sm: '60vh' },
                    maxHeight: { xs: 'none', sm: '60vh' },
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    touchAction: 'pan-y',
                    overscrollBehaviorX: 'none',
                    // Desktop-only: sleeker scrollbars. Mobile keeps native look.
                    // Note: include (pointer:fine) to avoid clobbering MUI's own
                    // sm breakpoint media query merge (which is also min-width:600px).
                    '@media (pointer: fine) and (min-width:600px)': {
                      scrollbarWidth: 'thin', // Firefox
                      scrollbarColor: (theme) =>
                        theme.palette.mode === 'dark'
                          ? 'rgba(255,255,255,0.5) transparent'
                          : 'rgba(0,0,0,0.35) transparent',
                      '&::-webkit-scrollbar': {
                        width: 6,
                      },
                      '&::-webkit-scrollbar-track': {
                        background: 'transparent',
                      },
                      '&::-webkit-scrollbar-thumb': {
                        backgroundColor: (theme) =>
                          theme.palette.mode === 'dark'
                            ? 'rgba(255,255,255,0.35)'
                            : 'rgba(0,0,0,0.25)',
                        borderRadius: 999,
                        border: '2px solid transparent',
                        backgroundClip: 'content-box',
                      },
                      '&:hover::-webkit-scrollbar-thumb': {
                        backgroundColor: (theme) =>
                          theme.palette.mode === 'dark'
                            ? 'rgba(255,255,255,0.5)'
                            : 'rgba(0,0,0,0.4)',
                      },
                    },
                  }}
                >
                  <List sx={{ overflowX: 'hidden' }}>
                    <DndContext
                      sensors={dndSensors}
                      collisionDetection={closestCenter}
                      modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={orderedShoppingItems.unchecked.map((i) => i.foodItemId)}
                        strategy={verticalListSortingStrategy}
                      >
                        {orderedShoppingItems.unchecked.map((item, index) => (
                          <SortableShoppingListRow
                            key={item.foodItemId}
                            item={item}
                            isLast={
                              index === orderedShoppingItems.unchecked.length - 1 &&
                              orderedShoppingItems.checked.length === 0
                            }
                          />
                        ))}
                      </SortableContext>

                      {orderedShoppingItems.checked.length > 0 && (
                        <>
                          {orderedShoppingItems.unchecked.length > 0 && <Divider />}
                          {orderedShoppingItems.checked.map((item, index) => (
                            <Box key={item.foodItemId}>
                              <ListItem
                                disableGutters
                                secondaryAction={
                                  <IconButton
                                    edge="end"
                                    aria-label="Reorder (disabled)"
                                    size="small"
                                    disabled
                                  >
                                    <DragIndicator fontSize="small" />
                                  </IconButton>
                                }
                                sx={{ px: 1, py: 0.25 }}
                              >
                                <ListItemIcon sx={{ minWidth: 40 }}>
                                  <Checkbox
                                    checked={item.checked}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleToggleItemChecked(item.foodItemId);
                                    }}
                                  />
                                </ListItemIcon>
                                <ListItemText
                                  primary={item.name}
                                  secondary={`${item.quantity} ${
                                    item.unit && item.unit !== 'each'
                                      ? getUnitForm(item.unit, item.quantity)
                                      : item.unit === 'each'
                                        ? 'each'
                                        : ''
                                  }`}
                                  onClick={() => handleOpenEditItemEditor(item)}
                                  sx={{
                                    cursor: 'pointer',
                                    textDecoration: item.checked ? 'line-through' : 'none',
                                    opacity: item.checked ? 0.6 : 1,
                                    pr: 4,
                                  }}
                                />
                              </ListItem>
                              {index < orderedShoppingItems.checked.length - 1 && <Divider />}
                            </Box>
                          ))}
                        </>
                      )}
                    </DndContext>
                  </List>
                </Box>
              </>
            )}
          </Box>
        </DialogContent>
      </Dialog>

      <ItemEditorDialog
        open={itemEditorOpen}
        mode={itemEditorMode}
        excludeFoodItemIds={shoppingListItems.map((item) => item.foodItemId)}
        initialDraft={itemEditorInitialDraft}
        onClose={() => setItemEditorOpen(false)}
        onSave={handleSaveItemFromEditor}
        onDelete={itemEditorMode === 'edit' ? handleDeleteItemFromEditor : undefined}
        onFoodItemAdded={async (newFoodItem) => {
          setFoodItems((prev) => [...prev, newFoodItem]);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmDialog.open}
        onClose={deleteConfirmDialog.closeDialog}
        sx={responsiveDialogStyle}
      >
        <DialogTitle onClose={deleteConfirmDialog.closeDialog}>Delete Store</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Are you sure you want to delete &quot;{selectedStore?.name}&quot;? This will also delete
            its shopping list. This action cannot be undone.
          </Typography>

          {selectedStore?.invitations?.some((inv) => inv.status === 'accepted') && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This store is shared with{' '}
              {selectedStore.invitations.filter((inv) => inv.status === 'accepted').length} user(s).
              They will lose access when you delete it.
            </Alert>
          )}

          <DialogActions primaryButtonIndex={1}>
            <Button
              onClick={deleteConfirmDialog.closeDialog}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteStore}
              color="error"
              variant="contained"
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Delete
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>

      {/* Meal Plan Selection Dialog */}
      <Dialog
        open={mealPlanSelectionDialog.open}
        onClose={mealPlanSelectionDialog.closeDialog}
        maxWidth="sm"
        fullWidth
        sx={responsiveDialogStyle}
      >
        <DialogTitle onClose={mealPlanSelectionDialog.closeDialog}>Select Meal Plans</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select one or more meal plans to add their items to your shopping list.
          </Typography>

          {availableMealPlans.length === 0 ? (
            <Alert severity="info">
              No meal plans available (must be within last 3 days or in the future).
            </Alert>
          ) : (
            <List>
              {availableMealPlans.map((mealPlan) => (
                <ListItem
                  key={mealPlan._id}
                  onClick={() => {
                    setSelectedMealPlanIds((prev) =>
                      prev.includes(mealPlan._id)
                        ? prev.filter((id) => id !== mealPlan._id)
                        : [...prev, mealPlan._id]
                    );
                  }}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: 'action.hover' },
                  }}
                >
                  <Checkbox
                    checked={selectedMealPlanIds.includes(mealPlan._id)}
                    onClick={(event) => {
                      // Prevent the parent ListItem onClick from firing too,
                      // otherwise a checkbox click toggles twice (net no change).
                      event.stopPropagation();
                    }}
                    onChange={() => {
                      setSelectedMealPlanIds((prev) =>
                        prev.includes(mealPlan._id)
                          ? prev.filter((id) => id !== mealPlan._id)
                          : [...prev, mealPlan._id]
                      );
                    }}
                  />
                  <ListItemText
                    primary={mealPlan.name}
                    secondary={new Date(mealPlan.startDate).toLocaleDateString()}
                  />
                </ListItem>
              ))}
            </List>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            This will extract all food items from the selected meal plans (including from recipes)
            and add them to your shopping list.
          </Typography>

          <DialogActions primaryButtonIndex={1}>
            <Button
              onClick={mealPlanSelectionDialog.closeDialog}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddItemsFromMealPlans}
              variant="contained"
              disabled={selectedMealPlanIds.length === 0}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Add Items
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>

      {/* Unit Conflict Resolution Dialog */}
      <Dialog
        open={unitConflictDialog.open}
        onClose={() => {}} // Prevent closing - must resolve conflicts
        maxWidth="sm"
        fullWidth
        sx={responsiveDialogStyle}
      >
        <DialogTitle showCloseButton={false}>
          Resolve Unit Conflict ({currentConflictIndex + 1} of {unitConflicts.length})
        </DialogTitle>
        <DialogContent>
          {unitConflicts.length > 0 && (
            <>
              <Typography variant="body1" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                {unitConflicts[currentConflictIndex]?.foodItemName}
              </Typography>

              {unitConflicts[currentConflictIndex]?.isAutoConverted ? (
                <Alert severity="success" sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Chip label="Auto-converted" size="small" color="success" variant="outlined" />
                    <Typography variant="body2">
                      {unitConflicts[currentConflictIndex]?.unitBreakdown?.map((entry, idx) => (
                        <span key={idx}>
                          {idx > 0 && ' + '}
                          {entry.quantity} {getUnitForm(entry.unit, entry.quantity)}
                        </span>
                      ))}
                      {' = '}
                      {Math.round(
                        (unitConflicts[currentConflictIndex]?.suggestedQuantity ?? 0) * 100
                      ) / 100}{' '}
                      {unitConflicts[currentConflictIndex]?.suggestedUnit
                        ? getUnitForm(
                            unitConflicts[currentConflictIndex]!.suggestedUnit!,
                            unitConflicts[currentConflictIndex]!.suggestedQuantity!
                          )
                        : ''}
                    </Typography>
                  </Box>
                </Alert>
              ) : (
                <Alert severity="info" sx={{ mb: 2 }}>
                  This item has different units that can&apos;t be auto-converted. Choose the
                  quantity and unit for your list.
                </Alert>
              )}

              <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Unit entries to combine:
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                  {unitConflicts[currentConflictIndex]?.unitBreakdown?.map((entry, idx) => (
                    <Typography
                      key={idx}
                      component="li"
                      variant="body1"
                      sx={{ fontWeight: 'medium' }}
                    >
                      {entry.quantity} {getUnitForm(entry.unit, entry.quantity)}
                    </Typography>
                  ))}
                </Box>
              </Paper>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {unitConflicts[currentConflictIndex]?.isAutoConverted
                  ? 'Review the suggested combined value:'
                  : 'Set the quantity and unit for your shopping list:'}
              </Typography>

              <Box
                sx={{
                  display: 'flex',
                  gap: 2,
                  mb: 3,
                  alignItems: 'flex-start',
                }}
              >
                <QuantityInput
                  label="Quantity"
                  value={getCurrentConflictResolution().quantity}
                  onChange={handleConflictQuantityChange}
                  size="small"
                  sx={{ width: 150 }}
                />
                <Autocomplete
                  options={getUnitOptions()}
                  value={
                    getUnitOptions().find(
                      (option) => option.value === getCurrentConflictResolution().unit
                    ) ?? null
                  }
                  onChange={(_, value) => {
                    if (value) {
                      handleConflictUnitChange(value.value);
                    }
                  }}
                  getOptionLabel={(option) =>
                    getUnitForm(option.value, getCurrentConflictResolution().quantity)
                  }
                  isOptionEqualToValue={(option, value) => option.value === value.value}
                  renderInput={(params) => <TextField {...params} label="Unit" size="small" />}
                  sx={{ flex: 1 }}
                />
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  gap: 2,
                  justifyContent: 'space-between',
                }}
              >
                <Button onClick={handlePreviousConflict} disabled={currentConflictIndex === 0}>
                  ← Previous
                </Button>
                <Button
                  onClick={handleNextConflict}
                  variant="contained"
                  disabled={!isCurrentConflictResolved()}
                >
                  {currentConflictIndex < unitConflicts.length - 1 ? 'Next →' : 'Complete'}
                </Button>
              </Box>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Share Store Dialog */}
      <Dialog
        open={shareDialog.open}
        onClose={shareDialog.closeDialog}
        maxWidth="sm"
        fullWidth
        sx={responsiveDialogStyle}
        TransitionProps={{ onEntered: () => shareEmailRef.current?.focus() }}
      >
        <DialogTitle onClose={shareDialog.closeDialog}>
          Share &quot;{sharingStore?.name}&quot;
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Invite users by email. They&apos;ll be able to view and edit the shopping list.
          </Typography>

          {/* Invite Section */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <TextField
              inputRef={shareEmailRef}
              label="Email Address"
              type="email"
              value={shareEmail}
              onChange={(e) => setShareEmail(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && shareEmail.trim()) {
                  handleInviteUser();
                }
              }}
              size="small"
              fullWidth
              placeholder="user@example.com"
            />
            <Button
              variant="contained"
              onClick={handleInviteUser}
              disabled={!shareEmail.trim()}
              sx={{ minWidth: 100 }}
            >
              Invite
            </Button>
          </Box>

          {/* Shared Users List */}
          {sharingStore?.invitations && sharingStore.invitations.length > 0 && (
            <>
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
                Shared With:
              </Typography>
              <List>
                {sharingStore.invitations
                  .filter((inv) => inv.status === 'accepted' || inv.status === 'pending')
                  .map((inv) => (
                    <ListItem key={inv.userId}>
                      <ListItemText
                        primary={inv.userEmail}
                        secondary={inv.status === 'pending' ? 'Pending' : 'Accepted'}
                      />
                      {inv.status === 'accepted' && (
                        <IconButton
                          size="small"
                          color="error"
                          title="Remove user"
                          onClick={() => handleRemoveUser(sharingStore._id, inv.userId)}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      )}
                    </ListItem>
                  ))}
              </List>
            </>
          )}

          <DialogActions primaryButtonIndex={0}>
            <Button onClick={shareDialog.closeDialog} sx={{ width: { xs: '100%', sm: 'auto' } }}>
              Done
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>

      {/* Pantry Check Dialog */}
      <Dialog
        open={pantryCheckDialog.open}
        onClose={pantryCheckDialog.closeDialog}
        maxWidth="sm"
        fullWidth
        sx={responsiveDialogStyle}
      >
        <DialogTitle onClose={pantryCheckDialog.closeDialog}>Pantry Check</DialogTitle>
        <DialogContent>
          {matchingPantryItems.length === 0 ? (
            <>
              <Alert severity="info">
                No items found in pantry. Add items to your pantry to use this feature.
              </Alert>
              <DialogActions primaryButtonIndex={0}>
                <Button
                  onClick={pantryCheckDialog.closeDialog}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Close
                </Button>
              </DialogActions>
            </>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                These shopping list items are in your pantry. Check them off to remove from the
                list, or adjust quantities as needed.
              </Typography>
              <List>
                {matchingPantryItems.map((item, index) => (
                  <Box key={item.foodItemId}>
                    <ListItem
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        py: 2,
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          width: '100%',
                          mb: 1,
                        }}
                      >
                        <Checkbox
                          checked={item.checked}
                          onChange={(e) => handlePantryItemCheck(item.foodItemId, e.target.checked)}
                          sx={{ mr: 1 }}
                        />
                        <ListItemText
                          primary={item.name}
                          secondary={`Current: ${item.currentQuantity} ${
                            item.unit && item.unit !== 'each'
                              ? getUnitForm(item.unit, item.currentQuantity)
                              : ''
                          }`}
                          sx={{
                            textDecoration: item.checked ? 'line-through' : 'none',
                            opacity: item.checked ? 0.6 : 1,
                          }}
                        />
                      </Box>
                      {!item.checked && (
                        <Box
                          sx={{
                            display: 'flex',
                            gap: 1,
                            ml: 6,
                            alignItems: 'flex-start',
                          }}
                        >
                          <QuantityInput
                            label="New Quantity"
                            value={item.newQuantity}
                            onChange={(newQuantity) =>
                              handlePantryItemQuantityChange(item.foodItemId, newQuantity)
                            }
                            size="small"
                            sx={{ width: 150 }}
                          />
                          <TextField
                            label="Unit"
                            size="small"
                            value={
                              item.unit && item.unit !== 'each'
                                ? getUnitForm(item.unit, item.newQuantity)
                                : ''
                            }
                            disabled
                            sx={{ width: 120 }}
                          />
                        </Box>
                      )}
                    </ListItem>
                    {index < matchingPantryItems.length - 1 && <Divider />}
                  </Box>
                ))}
              </List>
            </>
          )}
          {matchingPantryItems.length > 0 && (
            <DialogActions primaryButtonIndex={1}>
              <Button
                onClick={pantryCheckDialog.closeDialog}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleApplyPantryCheck}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Apply Changes
              </Button>
            </DialogActions>
          )}
        </DialogContent>
      </Dialog>

      {/* Emoji Picker Dialog */}
      <EmojiPicker
        open={emojiPickerDialog.open}
        onClose={emojiPickerDialog.closeDialog}
        onSelect={handleEmojiSelect}
        currentEmoji={newStoreEmoji}
      />

      {/* Leave Store Confirmation Dialog */}
      <Dialog
        open={leaveStoreConfirmDialog.open}
        onClose={leaveStoreConfirmDialog.closeDialog}
        sx={responsiveDialogStyle}
      >
        <DialogTitle onClose={leaveStoreConfirmDialog.closeDialog}>Leave Store</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to leave &quot;{selectedStore?.name}&quot;? You&apos;ll lose
            access to this shared store.
          </Typography>
          <DialogActions primaryButtonIndex={1}>
            <Button
              onClick={leaveStoreConfirmDialog.closeDialog}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmLeaveStore}
              color="warning"
              variant="contained"
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Leave Store
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>

      {/* Purchase History Dialog */}
      <StoreHistoryDialog
        open={!!historyDialogStore}
        onClose={handleCloseHistory}
        historyItems={historyItems}
        currentItems={selectedStore?._id === historyDialogStore?._id ? shoppingListItems : []}
        onAddItems={handleAddHistoryItems}
        loading={loadingHistory}
      />

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </AuthenticatedLayout>
  );
}

export default function ShoppingListsPage() {
  return (
    <Suspense
      fallback={
        <AuthenticatedLayout>
          <Container maxWidth="xl">
            <Box sx={{ py: { xs: 0.5, md: 1 } }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: { xs: 1.5, md: 2 },
                }}
              >
                <Skeleton variant="text" width={160} height={28} />
                <Skeleton variant="rounded" width={100} height={32} />
              </Box>
              <Box sx={{ maxWidth: 'md', mx: 'auto' }}>
                <Skeleton variant="rounded" height={36} sx={{ mb: 2 }} />
                {[55, 65, 50, 70].map((w, i) => (
                  <Box
                    key={i}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      minHeight: 40,
                      px: 1.5,
                      py: 1,
                      borderBottom: '1px solid',
                      borderBottomColor: 'divider',
                    }}
                  >
                    <Skeleton variant="text" width={24} height={24} sx={{ mr: 1, flexShrink: 0 }} />
                    <Skeleton variant="text" width={`${w}%`} height={20} sx={{ flex: '1 1 auto' }} />
                    <Skeleton variant="text" width={40} height={16} sx={{ flexShrink: 0, ml: 1 }} />
                  </Box>
                ))}
              </Box>
            </Box>
          </Container>
        </AuthenticatedLayout>
      }
    >
      <ShoppingListsPageContent />
    </Suspense>
  );
}
