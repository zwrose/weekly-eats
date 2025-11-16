"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import { 
  Container, 
  Typography, 
  Box, 
  CircularProgress, 
  Paper,
  Button,
  Dialog,
  DialogContent,
  TextField,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  Divider,
  Autocomplete,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Snackbar
} from "@mui/material";
import { ShoppingCart, Add, Edit, Delete, Share, Check, Close as CloseIcon, PersonAdd, Kitchen } from "@mui/icons-material";
import AuthenticatedLayout from "../../components/AuthenticatedLayout";
import { StoreWithShoppingList, ShoppingListItem } from "../../types/shopping-list";
import { fetchStores, createStore, updateStore, deleteStore, updateShoppingList, inviteUserToStore, respondToInvitation, removeUserFromStore, fetchPendingInvitations, fetchShoppingList } from "../../lib/shopping-list-utils";
import { useDialog, useConfirmDialog, useSearchPagination, useShoppingSync, usePersistentDialog, type ActiveUser } from "@/lib/hooks";
import EmojiPicker from "../../components/EmojiPicker";
import { DialogTitle } from "../../components/ui/DialogTitle";
import { DialogActions } from "../../components/ui/DialogActions";
import { responsiveDialogStyle } from "@/lib/theme";
import SearchBar from "@/components/optimized/SearchBar";
import Pagination from "@/components/optimized/Pagination";
import { getUnitOptions, getUnitForm } from "../../lib/food-items-utils";
import { MealPlanWithTemplate } from "../../types/meal-plan";
import { fetchMealPlans } from "../../lib/meal-plan-utils";
import { extractFoodItemsFromMealPlans, mergeWithShoppingList, UnitConflict } from "../../lib/meal-plan-to-shopping-list";
import { CalendarMonth } from "@mui/icons-material";
import { fetchPantryItems } from "../../lib/pantry-utils";

interface FoodItem {
  _id: string;
  name: string;
  singularName: string;
  pluralName: string;
  unit: string;
}

function ShoppingListsPageContent() {
  const { status } = useSession();
  const { data: session } = useSession();
  const [stores, setStores] = useState<StoreWithShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<StoreWithShoppingList | null>(null);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<Array<{
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
  }>>([]);
  
  // Search and pagination
  const storePagination = useSearchPagination<StoreWithShoppingList>({
    data: stores,
    itemsPerPage: 25,
    searchFunction: (store, term) =>
      store.name.toLowerCase().includes(term.toLowerCase()),
  });
  
  // Dialog states
  const createStoreDialog = useDialog();
  const editStoreDialog = useDialog();
  const viewListDialog = usePersistentDialog('shoppingList');
  const deleteConfirmDialog = useConfirmDialog();
  const emojiPickerDialog = useDialog();
  const mealPlanSelectionDialog = useDialog();
  const mealPlanConfirmDialog = useDialog();
  const unitConflictDialog = useDialog();
  const shareDialog = useDialog();
  const leaveStoreConfirmDialog = useConfirmDialog();
  const pantryCheckDialog = useDialog();
  
  // Notification state
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });
  
  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setSnackbar({ open: true, message, severity });
  };
  
  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };
  
  // Form states
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreEmoji, setNewStoreEmoji] = useState("🏪");
  const [editingStore, setEditingStore] = useState<StoreWithShoppingList | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [sharingStore, setSharingStore] = useState<StoreWithShoppingList | null>(null);
  
  // Shopping list states
  const [selectedFoodItem, setSelectedFoodItem] = useState<FoodItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [shoppingListItems, setShoppingListItems] = useState<ShoppingListItem[]>([]);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"before" | "after" | null>(null);
  const [shopMode, setShopMode] = useState(false); // false = Edit Mode, true = Shop Mode
  
  // Meal plan import states
  const [availableMealPlans, setAvailableMealPlans] = useState<MealPlanWithTemplate[]>([]);
  const [selectedMealPlanIds, setSelectedMealPlanIds] = useState<string[]>([]);
  const [unitConflicts, setUnitConflicts] = useState<UnitConflict[]>([]);
  const [currentConflictIndex, setCurrentConflictIndex] = useState(0);
  const [conflictResolutions, setConflictResolutions] = useState<Map<string, { quantity: number; unit: string }>>(new Map());

  // Pantry check states
  const [matchingPantryItems, setMatchingPantryItems] = useState<Array<{
    foodItemId: string;
    name: string;
    currentQuantity: number;
    unit: string;
    checked: boolean;
    newQuantity: number;
  }>>([]);
  const [loadingPantryCheck, setLoadingPantryCheck] = useState(false);
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
      setActiveUsers(users.filter(u => u.email !== session?.user?.email));
    },
    onItemChecked: (foodItemId, checked) => {
      // Remote toggle: update the local state for that item
      setShoppingListItems(prev =>
        prev.map(item =>
          item.foodItemId === foodItemId ? { ...item, checked } : item
        )
      );
    },
    onListUpdated: (items) => {
      // Merge: keep local checked state, but accept structural/other changes from server
      setShoppingListItems(prev => {
        const newItems = items as ShoppingListItem[];

        // Index current items by foodItemId for quick lookup
        const currentById = new Map(prev.map(item => [item.foodItemId, item]));

        return newItems.map(newItem => {
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
      setShoppingListItems(prev => prev.filter(item => item.foodItemId !== foodItemId));
      showSnackbar(`${updatedBy} removed an item from the list`, 'info');
    }
  });

  // NOTE: Polling-based sync was temporarily used as a fallback while SSE reliability
  // was being improved. With Redis-backed SSE broadcasting in place, this polling
  // effect is disabled to allow testing pure real-time behavior.

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [storesData, foodItemsData, invitationsData] = await Promise.all([
        fetchStores(),
        fetch('/api/food-items?limit=1000').then(res => res.json()),
        fetchPendingInvitations()
      ]);
      setStores(storesData);
      setFoodItems(foodItemsData);
      setPendingInvitations(invitationsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      loadData();
    }
  }, [status, loadData]);

  const handleCreateStore = async () => {
    if (!newStoreName.trim()) return;
    
    try {
      await createStore({ name: newStoreName.trim(), emoji: newStoreEmoji });
      setNewStoreName("");
      setNewStoreEmoji("🏪");
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
    setNewStoreEmoji(store.emoji || "🏪");
    editStoreDialog.openDialog();
  };

  const handleUpdateStore = async () => {
    if (!editingStore || !newStoreName.trim()) return;
    
    try {
      await updateStore(editingStore._id, { 
        name: newStoreName.trim(), 
        emoji: newStoreEmoji 
      });
      setNewStoreName("");
      setNewStoreEmoji("🏪");
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
    const updatedStore = updatedStores.find(s => s._id === store._id);
    
    setSharingStore(updatedStore || store);
    setShareEmail("");
    shareDialog.openDialog();
  };

  const handleInviteUser = async () => {
    if (!sharingStore || !shareEmail.trim()) return;
    
    try {
      await inviteUserToStore(sharingStore._id, shareEmail.trim());
      setShareEmail("");
      showSnackbar(`Invitation sent to ${shareEmail}`, 'success');
      
      // Refresh data and update the sharing store to show new invitation
      await loadData();
      const updatedStores = await fetchStores();
      const updatedStore = updatedStores.find(s => s._id === sharingStore._id);
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
        const updatedStore = updatedStores.find(s => s._id === storeId);
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
    const userId = (session?.user as { id?: string })?.id;
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
    const userId = (session?.user as { id?: string })?.id;
    return store.userId === userId;
  };

  const handleViewList = async (store: StoreWithShoppingList) => {
    setSelectedStore(store);
    setShopMode(false); // Always start in Edit Mode when opening from list
    viewListDialog.openDialog({ storeId: store._id, mode: 'edit' });

    try {
      const list = await fetchShoppingList(store._id);
      setShoppingListItems(list.items || []);
    } catch (error) {
      console.error('Error loading shopping list:', error);
      showSnackbar('Failed to load latest shopping list', 'error');
      setShoppingListItems(store.shoppingList?.items || []);
    }
  };

  const handleStartShopping = async (store: StoreWithShoppingList) => {
    setSelectedStore(store);
    setShopMode(true); // Start directly in Shop Mode
    viewListDialog.openDialog({ storeId: store._id, mode: 'shop' });

    try {
      const list = await fetchShoppingList(store._id);
      setShoppingListItems(list.items || []);
    } catch (error) {
      console.error('Error loading shopping list:', error);
      showSnackbar('Failed to load latest shopping list', 'error');
      setShoppingListItems(store.shoppingList?.items || []);
    }
  };

  // Restore selected store and mode from URL when dialog is open
  useEffect(() => {
    if (!viewListDialog.open) return;
    const storeId = viewListDialog.data?.storeId;
    if (!storeId) return;

    const store = stores.find(s => s._id === storeId);
    if (!store) {
      return;
    }

    setSelectedStore(store);
    setShopMode(viewListDialog.data?.mode === 'shop');

    // Always re-fetch the latest list when entering the dialog (including refresh)
    const loadLatestList = async () => {
      try {
        const list = await fetchShoppingList(store._id);
        setShoppingListItems(list.items || []);
      } catch (error) {
        console.error('Error loading shopping list:', error);
        showSnackbar('Failed to load latest shopping list', 'error');
        setShoppingListItems(store.shoppingList?.items || []);
      }
    };

    void loadLatestList();
  }, [viewListDialog.open, viewListDialog.data, stores]);

  const getSortedShoppingListItems = (): ShoppingListItem[] => {
    if (!shopMode) return shoppingListItems;
    
    // In shop mode, sort unchecked items first, checked items last
    return [...shoppingListItems].sort((a, b) => {
      if (a.checked === b.checked) return 0;
      return a.checked ? 1 : -1;
    });
  };

  const handleCompleteShoppingSession = async () => {
    if (!selectedStore) return;
    
    // Remove checked items from the list
    const uncheckedItems = shoppingListItems.filter(item => !item.checked);
    
    try {
      await updateShoppingList(selectedStore._id, { items: uncheckedItems });
      setShoppingListItems(uncheckedItems);
      setShopMode(false);
      viewListDialog.closeDialog();
      // Refresh stores list to update item counts
      const updatedStores = await fetchStores();
      setStores(updatedStores);
    } catch (error) {
      console.error('Error completing shopping session:', error);
      showSnackbar('Failed to complete shopping session', 'error');
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewStoreEmoji(emoji);
  };

  const handleAddItemToList = async () => {
    if (!selectedFoodItem || !selectedStore) return;
    
    // Check if item already exists
    const exists = shoppingListItems.some(item => item.foodItemId === selectedFoodItem._id);
    if (exists) {
      showSnackbar('This item is already in your shopping list', 'warning');
      return;
    }
    
    const newItem: ShoppingListItem = {
      foodItemId: selectedFoodItem._id,
      name: quantity === 1 ? selectedFoodItem.singularName : selectedFoodItem.pluralName,
      quantity,
      unit: selectedUnit || selectedFoodItem.unit,
      checked: false
    };
    
    const updatedItems = [...shoppingListItems, newItem];
    setShoppingListItems(updatedItems);
    
    // Auto-save to database
    try {
      await updateShoppingList(selectedStore._id, { items: updatedItems });
      // Refresh the stores list to update item count
      const updatedStores = await fetchStores();
      setStores(updatedStores);
    } catch (error) {
      console.error('Error saving shopping list:', error);
      showSnackbar('Failed to save item to shopping list', 'error');
      // Revert on error
      setShoppingListItems(shoppingListItems);
    }
    
    setSelectedFoodItem(null);
    setQuantity(1);
    setSelectedUnit('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedFoodItem) {
      e.preventDefault();
      handleAddItemToList();
    }
  };

  const handleRemoveItemFromList = async (foodItemId: string) => {
    if (!selectedStore) return;
    
    const updatedItems = shoppingListItems.filter(item => item.foodItemId !== foodItemId);
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
    setShoppingListItems(shoppingListItems.map(item =>
      item.foodItemId === foodItemId ? { ...item, checked: !item.checked } : item
    ));

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
          const store = await fetchStores().then(stores => 
            stores.find(s => s._id === selectedStore._id)
          );
          if (store) {
            setShoppingListItems(store.shoppingList?.items || []);
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

  // Meal plan import handlers
  const handleOpenMealPlanSelection = async () => {
    try {
      const allMealPlans = await fetchMealPlans();
      
      // Filter meal plans: last 3 days or future
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      const filtered = allMealPlans.filter(mp => {
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

  const handleConfirmMealPlanSelection = () => {
    if (selectedMealPlanIds.length === 0) return;
    
    mealPlanSelectionDialog.closeDialog();
    mealPlanConfirmDialog.openDialog();
  };

  const handleAddItemsFromMealPlans = async () => {
    if (!selectedStore) return;
    
    mealPlanConfirmDialog.closeDialog();
    
    try {
      // Get selected meal plans
      const selectedPlans = availableMealPlans.filter(mp => 
        selectedMealPlanIds.includes(mp._id)
      );
      
      // Extract food items from meal plans
      const extractedItems = await extractFoodItemsFromMealPlans(selectedPlans);
      
      // Create food items map for name lookup
      const foodItemsMap = new Map(
        foodItems.map(f => [f._id, { singularName: f.singularName, pluralName: f.pluralName, unit: f.unit }])
      );
      
      // Merge with existing shopping list
      const { mergedItems, conflicts } = mergeWithShoppingList(
        shoppingListItems,
        extractedItems,
        foodItemsMap
      );
      
      if (conflicts.length > 0) {
        // Has unit conflicts - show resolution dialog
        setUnitConflicts(conflicts);
        setCurrentConflictIndex(0);
        setConflictResolutions(new Map());
        setShoppingListItems(mergedItems); // Update with non-conflicted items
        unitConflictDialog.openDialog();
      } else {
        // No conflicts - save directly
        setShoppingListItems(mergedItems);
        await updateShoppingList(selectedStore._id, { items: mergedItems });
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

  const getCurrentConflictResolution = (): { quantity: number; unit: string } => {
    if (unitConflicts.length === 0) return { quantity: 1, unit: 'piece' };
    
    const conflict = unitConflicts[currentConflictIndex];
    const existing = conflictResolutions.get(conflict?.foodItemId);
    
    if (existing) return existing;
    
    // Default to existing values
    return {
      quantity: conflict?.existingQuantity || 1,
      unit: conflict?.existingUnit || 'piece'
    };
  };

  const handleConflictQuantityChange = (value: string) => {
    if (unitConflicts.length === 0) return;
    
    const quantity = Math.max(0.01, parseFloat(value) || 0);
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
    newResolutions.set(conflict.foodItemId, { quantity: current.quantity, unit });
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
    
    // Apply resolutions to shopping list
    const updatedItems = shoppingListItems.map(item => {
      const resolution = conflictResolutions.get(item.foodItemId);
      if (resolution) {
        const foodItem = foodItems.find(f => f._id === item.foodItemId);
        return {
          ...item,
          quantity: resolution.quantity,
          unit: resolution.unit,
          name: foodItem
            ? (resolution.quantity === 1 ? foodItem.singularName : foodItem.pluralName)
            : item.name
        };
      }
      return item;
    });
    
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
    }
  };

  // Pantry Check Handlers
  const handleOpenPantryCheck = async () => {
    if (!selectedStore) return;
    
    try {
      setLoadingPantryCheck(true);
      
      // Fetch pantry items
      const pantryItems = await fetchPantryItems();
      
      // Find shopping list items that are in pantry
      const matches = shoppingListItems
        .filter(item => pantryItems.some(p => p.foodItemId === item.foodItemId))
        .map(item => ({
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
    setMatchingPantryItems(prev =>
      prev.map(item =>
        item.foodItemId === foodItemId ? { ...item, checked } : item
      )
    );
  };

  const handlePantryItemQuantityChange = (foodItemId: string, newQuantity: number) => {
    setMatchingPantryItems(prev =>
      prev.map(item =>
        item.foodItemId === foodItemId ? { ...item, newQuantity } : item
      )
    );
  };

  const handleApplyPantryCheck = async () => {
    if (!selectedStore) return;
    
    try {
      // Apply changes from pantry check
      const updatedItems = shoppingListItems
        .map(item => {
          const match = matchingPantryItems.find(m => m.foodItemId === item.foodItemId);
          if (match) {
            // If checked off or quantity is 0, remove it (will be filtered out below)
            if (match.checked || match.newQuantity <= 0) {
              return null;
            }
            // Update quantity if changed
            if (match.newQuantity !== item.quantity) {
              const foodItem = foodItems.find(f => f._id === item.foodItemId);
              const newName = foodItem 
                ? (match.newQuantity === 1 ? foodItem.singularName : foodItem.pluralName)
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
      const changedCount = matchingPantryItems.filter(m => !m.checked && m.newQuantity !== m.currentQuantity).length;
      
      if (removedCount > 0 || changedCount > 0) {
        showSnackbar(
          `Pantry check complete! ${removedCount > 0 ? `Removed ${removedCount} item(s). ` : ''}${changedCount > 0 ? `Updated ${changedCount} quantity(ies).` : ''}`,
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

  const handleUpdateItemQuantity = async (foodItemId: string, newQuantity: number) => {
    if (!selectedStore) return;
    
    const updatedItems = shoppingListItems.map(item => {
      if (item.foodItemId === foodItemId) {
        // Update the name based on new quantity (singular/plural)
        const foodItem = foodItems.find(f => f._id === foodItemId);
        const newName = foodItem 
          ? (newQuantity === 1 ? foodItem.singularName : foodItem.pluralName)
          : item.name;
        return { ...item, quantity: newQuantity, name: newName };
      }
      return item;
    });
    
    setShoppingListItems(updatedItems);
    
    // Auto-save to database
    try {
      await updateShoppingList(selectedStore._id, { items: updatedItems });
      // Refresh the stores list
      const updatedStores = await fetchStores();
      setStores(updatedStores);
    } catch (error) {
      console.error('Error updating item quantity:', error);
      showSnackbar('Failed to update item quantity', 'error');
      // Revert on error
      setShoppingListItems(shoppingListItems);
    }
  };

  const handleUpdateItemUnit = async (foodItemId: string, newUnit: string) => {
    if (!selectedStore) return;
    
    const updatedItems = shoppingListItems.map(item =>
      item.foodItemId === foodItemId ? { ...item, unit: newUnit } : item
    );
    
    setShoppingListItems(updatedItems);
    
    // Auto-save to database
    try {
      await updateShoppingList(selectedStore._id, { items: updatedItems });
    } catch (error) {
      console.error('Error updating item unit:', error);
      showSnackbar('Failed to update item unit', 'error');
      // Revert on error
      setShoppingListItems(shoppingListItems);
    }
  };

  const handleReorderItem = async (
    sourceItemId: string,
    targetItemId: string,
    position: "before" | "after"
  ) => {
    if (!selectedStore || sourceItemId === targetItemId) {
      return;
    }

    const currentItems = [...shoppingListItems];
    const sourceIndex = currentItems.findIndex(item => item.foodItemId === sourceItemId);
    const targetIndex = currentItems.findIndex(item => item.foodItemId === targetItemId);

    if (sourceIndex === -1 || targetIndex === -1) {
      return;
    }

    let insertIndex = targetIndex;
    if (position === "after") {
      insertIndex = targetIndex + 1;
    }

    // Adjust for removal shifting indices when moving downwards
    if (sourceIndex < insertIndex) {
      insertIndex -= 1;
    }

    const updatedItems = [...currentItems];
    const [moved] = updatedItems.splice(sourceIndex, 1);
    updatedItems.splice(insertIndex, 0, moved);

    setShoppingListItems(updatedItems);

    try {
      await updateShoppingList(selectedStore._id, { items: updatedItems });
    } catch (error) {
      console.error('Error reordering items:', error);
      showSnackbar('Failed to save new order', 'error');
      setShoppingListItems(currentItems);
    }
  };

  // Show loading state while session is being fetched
  if (status === "loading") {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="md">
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      </AuthenticatedLayout>
    );
  }

  // Only redirect if session is definitely not available
  if (status === "unauthenticated") {
    redirect("/");
  }

  return (
    <AuthenticatedLayout>
      <Container maxWidth="xl">
        <Box sx={{ py: { xs: 0.5, md: 1 } }}>
          <Box sx={{ 
            display: "flex", 
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: "space-between", 
            alignItems: { xs: 'flex-start', sm: 'center' }, 
            gap: { xs: 2, sm: 0 },
            mb: { xs: 2, md: 4 } 
          }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <ShoppingCart sx={{ fontSize: 40, color: "#2e7d32" }} />
              <Typography variant="h3" component="h1" sx={{ color: "#2e7d32" }}>
                Shopping Lists
              </Typography>
            </Box>
            <Button 
              variant="contained" 
              startIcon={<Add />}
              onClick={createStoreDialog.openDialog}
              sx={{ 
                bgcolor: "#2e7d32", 
                "&:hover": { bgcolor: "#1b5e20" },
                width: { xs: '100%', sm: 'auto' }
              }}
            >
              Add Store
            </Button>
          </Box>

          {/* Pending Invitations Section */}
          {pendingInvitations.length > 0 && (
            <Paper sx={{ p: 3, mb: 4, maxWidth: 'md', mx: 'auto' }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonAdd />
                Pending Invitations ({pendingInvitations.length})
              </Typography>
              <List>
                {pendingInvitations.map((inv) => (
                  <Box key={inv.storeId}>
                    <ListItem>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                        <Typography variant="h6">{inv.storeEmoji}</Typography>
                        <ListItemText
                          primary={inv.storeName}
                          secondary={`Invited ${new Date(inv.invitation.invitedAt).toLocaleDateString()}`}
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
            </Paper>
          )}

          <Paper sx={{ p: 3, mb: 4, maxWidth: 'md', mx: 'auto' }}>
            <SearchBar
              value={storePagination.searchTerm}
              onChange={storePagination.setSearchTerm}
              placeholder="Search stores..."
            />

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            ) : storePagination.paginatedData.length === 0 ? (
              <Alert severity="info">
                {storePagination.searchTerm ? "No stores match your search criteria" : "No stores yet. Add your first store to create shopping lists."}
              </Alert>
            ) : (
              <>
                {/* Desktop Table View */}
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ width: '50%', fontWeight: 'bold', wordWrap: 'break-word' }}>Store (click to view list)</TableCell>
                          <TableCell align="center" sx={{ width: '20%', fontWeight: 'bold', wordWrap: 'break-word' }}>Items on Lists</TableCell>
                          <TableCell align="center" sx={{ width: '30%', fontWeight: 'bold', wordWrap: 'break-word' }}>Manage Store</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {storePagination.paginatedData.map((store) => (
                          <TableRow 
                            key={store._id}
                            onClick={() => handleViewList(store)}
                            sx={{ 
                              '&:hover': { backgroundColor: 'action.hover' },
                              cursor: 'pointer'
                            }}
                          >
                            <TableCell sx={{ wordWrap: 'break-word' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="h6">{store.emoji}</Typography>
                                <Typography variant="body1">{store.name}</Typography>
                              </Box>
                            </TableCell>
                            <TableCell align="center" sx={{ wordWrap: 'break-word' }}>
                              <Typography variant="body2" color="text.secondary">
                                {store.shoppingList?.items?.length || 0}
                              </Typography>
                            </TableCell>
                            <TableCell align="center" sx={{ wordWrap: 'break-word' }}>
                              <Box sx={{ display: "flex", gap: 1, alignItems: "center", justifyContent: "center" }}>
                                <IconButton 
                                  size="small"
                                  color="success"
                                  title="Start Shopping"
                                  disabled={!store.shoppingList?.items?.length}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartShopping(store);
                                  }}
                                >
                                  <ShoppingCart fontSize="small" />
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
                                    >
                                      <Share fontSize="small" />
                                    </IconButton>
                                    <IconButton 
                                      size="small"
                                      title="Edit Store"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditStore(store);
                                      }}
                                    >
                                      <Edit fontSize="small" />
                                    </IconButton>
                                    <IconButton 
                                      size="small" 
                                      color="error"
                                      title="Delete Store"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedStore(store);
                                        deleteConfirmDialog.openDialog();
                                      }}
                                    >
                                      <Delete fontSize="small" />
                                    </IconButton>
                                  </>
                                ) : (
                                  <IconButton 
                                    size="small"
                                    color="warning"
                                    title="Leave Store"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleLeaveStore(store);
                                    }}
                                  >
                                    <CloseIcon fontSize="small" />
                                  </IconButton>
                                )}
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>

                {/* Mobile Card View */}
                <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                  {storePagination.paginatedData.map((store) => (
                    <Paper
                      key={store._id}
                      onClick={() => handleViewList(store)}
                      sx={{
                        p: 3,
                        mb: 2,
                        boxShadow: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        cursor: 'pointer',
                        '&:hover': { 
                          backgroundColor: 'action.hover',
                          transform: 'translateY(-2px)',
                          boxShadow: 4
                        },
                        transition: 'all 0.2s ease-in-out'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Typography variant="h4">{store.emoji}</Typography>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                            {store.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {store.shoppingList?.items?.length || 0} items
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                        <IconButton 
                          size="small"
                          color="success"
                          title="Start Shopping"
                          disabled={!store.shoppingList?.items?.length}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartShopping(store);
                          }}
                        >
                          <ShoppingCart fontSize="small" />
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
                            >
                              <Share fontSize="small" />
                            </IconButton>
                            <IconButton 
                              size="small"
                              title="Edit Store"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditStore(store);
                              }}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                            <IconButton 
                              size="small" 
                              color="error"
                              title="Delete Store"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStore(store);
                                deleteConfirmDialog.openDialog();
                              }}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </>
                        ) : (
                          <IconButton 
                            size="small"
                            color="warning"
                            title="Leave Store"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLeaveStore(store);
                            }}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </Paper>
                  ))}
                </Box>

                <Pagination
                  count={storePagination.totalPages}
                  page={storePagination.currentPage}
                  onChange={storePagination.setCurrentPage}
                  show={storePagination.totalPages > 1}
                />
              </>
            )}
          </Paper>
        </Box>
      </Container>

      {/* Create Store Dialog */}
      <Dialog
        open={createStoreDialog.open}
        onClose={createStoreDialog.closeDialog}
        sx={responsiveDialogStyle}
      >
        <DialogTitle onClose={createStoreDialog.closeDialog}>
          Add Store
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
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
                  minHeight: 80
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
              autoFocus
              onKeyPress={(e) => {
                if (e.key === 'Enter' && newStoreName.trim()) {
                  handleCreateStore();
                }
              }}
            />
          </Box>
          <DialogActions primaryButtonIndex={1}>
            <Button onClick={createStoreDialog.closeDialog} sx={{ width: { xs: '100%', sm: 'auto' } }}>
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
      >
        <DialogTitle onClose={editStoreDialog.closeDialog}>
          Edit Store
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
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
                  minHeight: 80
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
              autoFocus
            />
          </Box>
          <DialogActions primaryButtonIndex={1}>
            <Button onClick={editStoreDialog.closeDialog} sx={{ width: { xs: '100%', sm: 'auto' } }}>
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
        sx={responsiveDialogStyle}
      >
        <DialogTitle onClose={viewListDialog.closeDialog}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="h4">{selectedStore?.emoji}</Typography>
              <Typography variant="h6">{selectedStore?.name}</Typography>
            </Box>
            {(activeUsers.length > 0 || shoppingSync.isConnected) && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                {activeUsers.length > 0 && (
                  <>
                    <Typography variant="caption" color="text.secondary">
                      Also viewing:
                    </Typography>
                    {activeUsers.map((user, index) => (
                      <Box
                        key={index}
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          px: 1,
                          py: 0.5,
                          borderRadius: 1,
                          bgcolor: "primary.main",
                          color: "primary.contrastText",
                          fontSize: "0.75rem"
                        }}
                      >
                        {user.name}
                      </Box>
                    ))}
                  </>
                )}
                {shoppingSync.isConnected && (
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.5,
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      bgcolor: "success.main",
                      color: "success.contrastText",
                      fontSize: "0.7rem"
                    }}
                  >
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: "success.contrastText"
                      }}
                    />
                    Live
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {/* Edit Mode */}
            {!shopMode && (
              <>
                {/* Edit Mode - Items List */}
                {shoppingListItems.length === 0 ? (
                  <Alert severity="info" sx={{ mb: 3 }}>
                    No items in this shopping list yet. Add items below to get started.
                  </Alert>
                ) : (
                  <List>
                    {shoppingListItems.map((item, index) => (
                      <Box key={item.foodItemId}>
                        <ListItem
                          sx={{
                            flexDirection: 'column',
                            alignItems: 'stretch',
                            py: 2,
                            cursor: 'grab',
                            borderTop:
                              dragOverItemId === item.foodItemId && dragOverPosition === 'before'
                                ? '2px solid'
                                : 'none',
                            borderBottom:
                              dragOverItemId === item.foodItemId && dragOverPosition === 'after'
                                ? '2px solid'
                                : 'none',
                            borderColor:
                              dragOverItemId === item.foodItemId ? 'primary.main' : 'transparent',
                          }}
                          draggable
                          onDragStart={() => setDraggedItemId(item.foodItemId)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (!draggedItemId || draggedItemId === item.foodItemId) {
                              return;
                            }

                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            const offsetY = e.clientY - rect.top;
                            const position = offsetY < rect.height / 2 ? 'before' : 'after';

                            setDragOverItemId(item.foodItemId);
                            setDragOverPosition(position);
                          }}
                          onDragLeave={() => {
                            if (dragOverItemId === item.foodItemId) {
                              setDragOverItemId(null);
                              setDragOverPosition(null);
                            }
                          }}
                          onDrop={() => {
                            if (draggedItemId && dragOverPosition) {
                              void handleReorderItem(draggedItemId, item.foodItemId, dragOverPosition);
                            }
                            setDraggedItemId(null);
                            setDragOverItemId(null);
                            setDragOverPosition(null);
                          }}
                          onDragEnd={() => {
                            setDraggedItemId(null);
                            setDragOverItemId(null);
                            setDragOverPosition(null);
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', flex: 1 }}>
                              {item.name}
                            </Typography>
                            <IconButton
                              onClick={() => handleRemoveItemFromList(item.foodItemId)}
                              color="error"
                              size="small"
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Box>
                          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            <TextField
                              label="Quantity"
                              type="number"
                              inputProps={{ step: 0.01, min: 0.01 }}
                              value={item.quantity}
                              onChange={(e) => {
                                const newQty = Math.max(0.01, parseFloat(e.target.value) || 0.01);
                                handleUpdateItemQuantity(item.foodItemId, newQty);
                              }}
                              size="small"
                              sx={{ width: 100 }}
                            />
                            <Autocomplete
                              options={getUnitOptions()}
                              value={getUnitOptions().find(option => option.value === item.unit) ?? null}
                              onChange={(_, value) => {
                                if (value) {
                                  handleUpdateItemUnit(item.foodItemId, value.value);
                                }
                              }}
                              getOptionLabel={(option) =>
                                getUnitForm(option.value, item.quantity)
                              }
                              isOptionEqualToValue={(option, value) => option.value === value.value}
                              renderInput={(params) => (
                                <TextField {...params} label="Unit" size="small" />
                              )}
                              sx={{ flex: 1, minWidth: 150 }}
                            />
                          </Box>
                        </ListItem>
                        {index < shoppingListItems.length - 1 && <Divider />}
                      </Box>
                    ))}
                  </List>
                )}

                <Divider sx={{ my: 3 }} />

                {/* Add Item Section - Moved to bottom */}
                <Paper elevation={0} sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Add Item
                  </Typography>
                  {/* Food Item - Full width on mobile */}
                  <Autocomplete
                    options={foodItems.filter(item => 
                      !shoppingListItems.some(listItem => listItem.foodItemId === item._id)
                    )}
                    getOptionLabel={(option) => option.name}
                    value={selectedFoodItem}
                    onChange={(_, value) => {
                      setSelectedFoodItem(value);
                      if (value) {
                        setSelectedUnit(value.unit);
                      } else {
                        setSelectedUnit('');
                      }
                    }}
                    renderInput={(params) => (
                      <TextField {...params} label="Food Item" size="small" onKeyDown={handleKeyDown} />
                    )}
                    sx={{ mb: 2 }}
                  />
                  {/* Quantity, Unit, and Add button in a row */}
                  <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'flex-start' }}>
                    <TextField
                      label="Quantity"
                      type="number"
                      inputProps={{ step: 0.01, min: 0.01 }}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(0.01, parseFloat(e.target.value) || 0.01))}
                      onKeyDown={handleKeyDown}
                      size="small"
                      sx={{ width: { xs: '100%', sm: 100 } }}
                    />
                    <Autocomplete
                      options={getUnitOptions()}
                      value={getUnitOptions().find(option => option.value === selectedUnit) ?? null}
                      onChange={(_, value) => setSelectedUnit(value?.value || '')}
                      getOptionLabel={(option) =>
                        getUnitForm(option.value, quantity)
                      }
                      isOptionEqualToValue={(option, value) => option.value === value.value}
                      disabled={!selectedFoodItem}
                      renderInput={(params) => (
                        <TextField {...params} label="Unit" size="small" onKeyDown={handleKeyDown} />
                      )}
                      sx={{ width: { xs: '100%', sm: 150 } }}
                    />
                    <Button
                      variant="contained"
                      onClick={handleAddItemToList}
                      disabled={!selectedFoodItem}
                      startIcon={<Add />}
                      sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >
                      Add
                    </Button>
                  </Box>
                </Paper>

                <Divider sx={{ my: 3 }} />

                {/* Add from Meal Plans and Pantry Check Buttons */}
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<CalendarMonth />}
                    onClick={handleOpenMealPlanSelection}
                    fullWidth
                    sx={{ flex: { sm: 1 } }}
                  >
                    Add Items from Meal Plans
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={loadingPantryCheck ? <CircularProgress size={20} sx={{ color: '#9c27b0' }} /> : <Kitchen />}
                    onClick={handleOpenPantryCheck}
                    disabled={loadingPantryCheck}
                    fullWidth
                    sx={{ 
                      flex: { sm: 1 },
                      borderColor: '#9c27b0',
                      color: '#9c27b0',
                      '&:hover': {
                        borderColor: '#7b1fa2',
                        bgcolor: 'rgba(156, 39, 176, 0.04)'
                      }
                    }}
                  >
                    {loadingPantryCheck ? 'Loading...' : 'Pantry Check'}
                  </Button>
                </Box>

                <Divider sx={{ my: 3 }} />
              </>
            )}

            {/* Shop Mode */}
            {shopMode && (
              <>
                {shoppingListItems.length === 0 ? (
                  <Alert severity="info">
                    No items in this shopping list. Switch to Edit Mode to add items.
                  </Alert>
                ) : (
                  <>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Check off items as you shop. Checked items will move to the bottom.
                    </Typography>
                    <List>
                      {getSortedShoppingListItems().map((item, index) => (
                        <Box key={item.foodItemId}>
                          <ListItem
                            onClick={() => handleToggleItemChecked(item.foodItemId)}
                            sx={{ 
                              cursor: 'pointer',
                              '&:hover': { backgroundColor: 'action.hover' }
                            }}
                          >
                            <Checkbox
                              checked={item.checked}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleItemChecked(item.foodItemId);
                              }}
                            />
                            <ListItemText
                              primary={item.name}
                              secondary={`${item.quantity} ${item.unit && item.unit !== 'each' ? getUnitForm(item.unit, item.quantity) : ''}`}
                              sx={{
                                textDecoration: item.checked ? 'line-through' : 'none',
                                opacity: item.checked ? 0.6 : 1
                              }}
                            />
                          </ListItem>
                          {index < shoppingListItems.length - 1 && <Divider />}
                        </Box>
                      ))}
                    </List>
                  </>
                )}
              </>
            )}
          </Box>
          
          {/* Mode Toggle - Moved to bottom */}
          <Box sx={{ display: 'flex', gap: 2, mt: 3, mb: 2 }}>
            <Button
              variant={!shopMode ? "contained" : "outlined"}
              onClick={() => {
                setShopMode(false);
                if (selectedStore) {
                  viewListDialog.openDialog({ storeId: selectedStore._id, mode: 'edit' });
                }
              }}
              fullWidth
            >
              Edit Mode
            </Button>
            <Button
              variant={shopMode ? "contained" : "outlined"}
              onClick={() => {
                setShopMode(true);
                if (selectedStore) {
                  viewListDialog.openDialog({ storeId: selectedStore._id, mode: 'shop' });
                }
              }}
              fullWidth
              disabled={shoppingListItems.length === 0}
            >
              Shop Mode
            </Button>
          </Box>

          <DialogActions primaryButtonIndex={0}>
            {!shopMode ? (
              <Button 
                onClick={viewListDialog.closeDialog}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Close
              </Button>
            ) : (
              <>
                <Button 
                  onClick={handleCompleteShoppingSession}
                  variant="contained"
                  color="success"
                  disabled={!shoppingListItems.some(item => item.checked)}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Complete Shopping
                </Button>
                <Button 
                  onClick={viewListDialog.closeDialog}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Close
                </Button>
              </>
            )}
          </DialogActions>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmDialog.open}
        onClose={deleteConfirmDialog.closeDialog}
        sx={responsiveDialogStyle}
      >
        <DialogTitle onClose={deleteConfirmDialog.closeDialog}>
          Delete Store
        </DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Are you sure you want to delete &quot;{selectedStore?.name}&quot;? This will also delete its shopping list. This action cannot be undone.
          </Typography>
          
          {selectedStore?.invitations?.some(inv => inv.status === 'accepted') && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This store is shared with {selectedStore.invitations.filter(inv => inv.status === 'accepted').length} user(s). 
              They will lose access when you delete it.
            </Alert>
          )}
          
          <DialogActions primaryButtonIndex={1}>
            <Button onClick={deleteConfirmDialog.closeDialog} sx={{ width: { xs: '100%', sm: 'auto' } }}>
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
        <DialogTitle onClose={mealPlanSelectionDialog.closeDialog}>
          Select Meal Plans
        </DialogTitle>
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
                    setSelectedMealPlanIds(prev =>
                      prev.includes(mealPlan._id)
                        ? prev.filter(id => id !== mealPlan._id)
                        : [...prev, mealPlan._id]
                    );
                  }}
                  sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                >
                  <Checkbox
                    checked={selectedMealPlanIds.includes(mealPlan._id)}
                    onChange={() => {
                      setSelectedMealPlanIds(prev =>
                        prev.includes(mealPlan._id)
                          ? prev.filter(id => id !== mealPlan._id)
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
          
          <DialogActions primaryButtonIndex={1}>
            <Button onClick={mealPlanSelectionDialog.closeDialog} sx={{ width: { xs: '100%', sm: 'auto' } }}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmMealPlanSelection}
              variant="contained"
              disabled={selectedMealPlanIds.length === 0}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Next
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>

      {/* Meal Plan Confirmation Dialog */}
      <Dialog
        open={mealPlanConfirmDialog.open}
        onClose={mealPlanConfirmDialog.closeDialog}
        sx={responsiveDialogStyle}
      >
        <DialogTitle onClose={mealPlanConfirmDialog.closeDialog}>
          Confirm Add Items
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Add items from:
          </Typography>
          <List>
            {availableMealPlans
              .filter(mp => selectedMealPlanIds.includes(mp._id))
              .map((mp) => (
                <ListItem key={mp._id}>
                  <ListItemText primary={mp.name} />
                </ListItem>
              ))}
          </List>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            This will extract all food items from these meal plans (including from recipes) and add them to your shopping list.
          </Typography>
          
          <DialogActions primaryButtonIndex={1}>
            <Button onClick={mealPlanConfirmDialog.closeDialog} sx={{ width: { xs: '100%', sm: 'auto' } }}>
              Cancel
            </Button>
            <Button
              onClick={handleAddItemsFromMealPlans}
              variant="contained"
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
              
              <Alert severity="info" sx={{ mb: 2 }}>
                This item has different units in your shopping list and the meal plans.
              </Alert>
              
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Already on shopping list:
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                  {unitConflicts[currentConflictIndex]?.existingQuantity}{' '}
                  {unitConflicts[currentConflictIndex]?.existingUnit
                    ? getUnitForm(
                        unitConflicts[currentConflictIndex]!.existingUnit,
                        unitConflicts[currentConflictIndex]!.existingQuantity
                      )
                    : ''}
                </Typography>
              </Paper>
              
              <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  From meal plans:
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                  {unitConflicts[currentConflictIndex]?.newQuantity}{' '}
                  {unitConflicts[currentConflictIndex]?.newUnit
                    ? getUnitForm(
                        unitConflicts[currentConflictIndex]!.newUnit,
                        unitConflicts[currentConflictIndex]!.newQuantity
                      )
                    : ''}
                </Typography>
              </Paper>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Set the quantity and unit for your shopping list:
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <TextField
                  label="Quantity"
                  type="number"
                  inputProps={{ step: 0.01, min: 0.01 }}
                  value={getCurrentConflictResolution().quantity}
                  onChange={(e) => handleConflictQuantityChange(e.target.value)}
                  size="small"
                  sx={{ width: 150 }}
                />
                <Autocomplete
                  options={getUnitOptions()}
                  value={getUnitOptions().find(option => option.value === getCurrentConflictResolution().unit) ?? null}
                  onChange={(_, value) => {
                    if (value) {
                      handleConflictUnitChange(value.value);
                    }
                  }}
                  getOptionLabel={(option) =>
                    getUnitForm(option.value, getCurrentConflictResolution().quantity)
                  }
                  isOptionEqualToValue={(option, value) => option.value === value.value}
                  renderInput={(params) => (
                    <TextField {...params} label="Unit" size="small" />
                  )}
                  sx={{ flex: 1 }}
                />
              </Box>
              
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between' }}>
                <Button
                  onClick={handlePreviousConflict}
                  disabled={currentConflictIndex === 0}
                >
                  ← Previous
                </Button>
                <Button
                  onClick={handleNextConflict}
                  variant="contained"
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
                  .filter(inv => inv.status === 'accepted' || inv.status === 'pending')
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
        <DialogTitle onClose={pantryCheckDialog.closeDialog}>
          Pantry Check
        </DialogTitle>
        <DialogContent>
          {matchingPantryItems.length === 0 ? (
            <>
              <Alert severity="info">
                No items found in pantry. Add items to your pantry to use this feature.
              </Alert>
              <DialogActions primaryButtonIndex={0}>
                <Button onClick={pantryCheckDialog.closeDialog} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                  Close
                </Button>
              </DialogActions>
            </>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                These shopping list items are in your pantry. Check them off to remove from the list, or adjust quantities as needed.
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
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: 1 }}>
                        <Checkbox
                          checked={item.checked}
                          onChange={(e) => handlePantryItemCheck(item.foodItemId, e.target.checked)}
                          sx={{ mr: 1 }}
                        />
                        <ListItemText
                          primary={item.name}
                          secondary={`Current: ${item.currentQuantity} ${item.unit && item.unit !== 'each' ? getUnitForm(item.unit, item.currentQuantity) : ''}`}
                          sx={{
                            textDecoration: item.checked ? 'line-through' : 'none',
                            opacity: item.checked ? 0.6 : 1,
                          }}
                        />
                      </Box>
                      {!item.checked && (
                        <Box sx={{ display: 'flex', gap: 1, ml: 6 }}>
                          <TextField
                            label="New Quantity"
                            type="number"
                            size="small"
                            inputProps={{ step: 0.01, min: 0 }}
                            value={item.newQuantity}
                            onChange={(e) =>
                              handlePantryItemQuantityChange(
                                item.foodItemId,
                                Math.max(0, parseFloat(e.target.value) || 0)
                              )
                            }
                            sx={{ width: 150 }}
                          />
                          <TextField
                            label="Unit"
                            size="small"
                            value={item.unit && item.unit !== 'each' ? getUnitForm(item.unit, item.newQuantity) : ''}
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
            <Button onClick={pantryCheckDialog.closeDialog} sx={{ width: { xs: '100%', sm: 'auto' } }}>
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
        <DialogTitle onClose={leaveStoreConfirmDialog.closeDialog}>
          Leave Store
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to leave &quot;{selectedStore?.name}&quot;? You&apos;ll lose access to this shared store.
          </Typography>
          <DialogActions primaryButtonIndex={1}>
            <Button onClick={leaveStoreConfirmDialog.closeDialog} sx={{ width: { xs: '100%', sm: 'auto' } }}>
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
          <Container maxWidth="md">
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          </Container>
        </AuthenticatedLayout>
      }
    >
      <ShoppingListsPageContent />
    </Suspense>
  );
}
