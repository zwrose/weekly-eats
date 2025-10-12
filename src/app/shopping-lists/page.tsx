"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
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
  TableRow
} from "@mui/material";
import { ShoppingCart, Add, Edit, Delete } from "@mui/icons-material";
import AuthenticatedLayout from "../../components/AuthenticatedLayout";
import { StoreWithShoppingList, ShoppingListItem } from "../../types/shopping-list";
import { fetchStores, createStore, updateStore, deleteStore, updateShoppingList } from "../../lib/shopping-list-utils";
import { useDialog, useConfirmDialog, useSearchPagination } from "@/lib/hooks";
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

interface FoodItem {
  _id: string;
  name: string;
  singularName: string;
  pluralName: string;
  unit: string;
}

export default function ShoppingListsPage() {
  const { status } = useSession();
  const [stores, setStores] = useState<StoreWithShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<StoreWithShoppingList | null>(null);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  
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
  const viewListDialog = useDialog();
  const deleteConfirmDialog = useConfirmDialog();
  const emojiPickerDialog = useDialog();
  const mealPlanSelectionDialog = useDialog();
  const mealPlanConfirmDialog = useDialog();
  const unitConflictDialog = useDialog();
  
  // Form states
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreEmoji, setNewStoreEmoji] = useState("🏪");
  const [editingStore, setEditingStore] = useState<StoreWithShoppingList | null>(null);
  
  // Shopping list states
  const [selectedFoodItem, setSelectedFoodItem] = useState<FoodItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [shoppingListItems, setShoppingListItems] = useState<ShoppingListItem[]>([]);
  const [shopMode, setShopMode] = useState(false); // false = Edit Mode, true = Shop Mode
  
  // Meal plan import states
  const [availableMealPlans, setAvailableMealPlans] = useState<MealPlanWithTemplate[]>([]);
  const [selectedMealPlanIds, setSelectedMealPlanIds] = useState<string[]>([]);
  const [unitConflicts, setUnitConflicts] = useState<UnitConflict[]>([]);
  const [currentConflictIndex, setCurrentConflictIndex] = useState(0);
  const [conflictResolutions, setConflictResolutions] = useState<Map<string, { quantity: number; unit: string }>>(new Map());

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [storesData, foodItemsData] = await Promise.all([
        fetchStores(),
        fetch('/api/food-items?limit=1000').then(res => res.json())
      ]);
      setStores(storesData);
      setFoodItems(foodItemsData);
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
      alert('Failed to create store');
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
      alert('Failed to update store');
    }
  };

  const handleDeleteStore = async () => {
    if (!selectedStore) return;
    
    try {
      await deleteStore(selectedStore._id);
      deleteConfirmDialog.closeDialog();
      viewListDialog.closeDialog();
      setSelectedStore(null);
      loadData();
    } catch (error) {
      console.error('Error deleting store:', error);
      alert('Failed to delete store');
    }
  };

  const handleViewList = (store: StoreWithShoppingList) => {
    setSelectedStore(store);
    setShoppingListItems(store.shoppingList?.items || []);
    setShopMode(false); // Always start in Edit Mode
    viewListDialog.openDialog();
  };

  const handleStartShopping = (store: StoreWithShoppingList) => {
    setSelectedStore(store);
    setShoppingListItems(store.shoppingList?.items || []);
    setShopMode(true); // Start directly in Shop Mode
    viewListDialog.openDialog();
  };

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
      alert('Failed to complete shopping session');
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
      alert('This item is already in your shopping list');
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
      alert('Failed to save item to shopping list');
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
      alert('Failed to remove item from shopping list');
      // Revert on error
      setShoppingListItems(shoppingListItems);
    }
  };

  const handleToggleItemChecked = (foodItemId: string) => {
    setShoppingListItems(shoppingListItems.map(item =>
      item.foodItemId === foodItemId ? { ...item, checked: !item.checked } : item
    ));
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
      alert('Failed to load meal plans');
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
      alert('Failed to add items from meal plans');
    }
  };

  const handleResolveConflict = (quantity: number, unit: string) => {
    const conflict = unitConflicts[currentConflictIndex];
    const newResolutions = new Map(conflictResolutions);
    newResolutions.set(conflict.foodItemId, { quantity, unit });
    setConflictResolutions(newResolutions);
    
    if (currentConflictIndex < unitConflicts.length - 1) {
      // Move to next conflict
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
      alert('Failed to save shopping list');
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
      alert('Failed to update item quantity');
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
      alert('Failed to update item unit');
      // Revert on error
      setShoppingListItems(shoppingListItems);
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
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="h4">{selectedStore?.emoji}</Typography>
            <Typography variant="h6">{selectedStore?.name}</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {/* Edit Mode */}
            {!shopMode && (
              <>
                {/* Add from Meal Plans Button */}
                <Button
                  variant="outlined"
                  startIcon={<CalendarMonth />}
                  onClick={handleOpenMealPlanSelection}
                  fullWidth
                  sx={{ mb: 3 }}
                >
                  Add Items from Meal Plans
                </Button>

                {/* Edit Mode - Items List */}
                {shoppingListItems.length === 0 ? (
                  <Alert severity="info" sx={{ mb: 3 }}>
                    No items in this shopping list yet. Add items below to get started.
                  </Alert>
                ) : (
                  <List>
                    {shoppingListItems.map((item, index) => (
                      <Box key={item.foodItemId}>
                        <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>
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
                              value={item.quantity}
                              onChange={(e) => {
                                const newQty = Math.max(1, parseInt(e.target.value) || 1);
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
                              getOptionLabel={(option) => option.label}
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

                {/* Add Item Section - Moved to bottom */}
                <Paper elevation={1} sx={{ p: 2, mt: 3 }}>
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
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      onKeyDown={handleKeyDown}
                      size="small"
                      sx={{ width: { xs: '100%', sm: 100 } }}
                    />
                    <Autocomplete
                      options={getUnitOptions()}
                      value={getUnitOptions().find(option => option.value === selectedUnit) ?? null}
                      onChange={(_, value) => setSelectedUnit(value?.value || '')}
                      getOptionLabel={(option) => option.label}
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
                              onChange={() => handleToggleItemChecked(item.foodItemId)}
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
              onClick={() => setShopMode(false)}
              fullWidth
            >
              Edit Mode
            </Button>
            <Button
              variant={shopMode ? "contained" : "outlined"}
              onClick={() => setShopMode(true)}
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
          <Typography>
            Are you sure you want to delete &quot;{selectedStore?.name}&quot;? This will also delete its shopping list. This action cannot be undone.
          </Typography>
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
              <Typography variant="body1" gutterBottom>
                <strong>{unitConflicts[currentConflictIndex]?.foodItemName}</strong> has different units:
              </Typography>
              
              <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                <Typography variant="body2" gutterBottom>
                  Already on list:
                </Typography>
                <Typography variant="body1">
                  {unitConflicts[currentConflictIndex]?.existingQuantity}{' '}
                  {unitConflicts[currentConflictIndex]?.existingUnit}
                </Typography>
              </Paper>
              
              <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
                <Typography variant="body2" gutterBottom>
                  From meal plans:
                </Typography>
                <Typography variant="body1">
                  {unitConflicts[currentConflictIndex]?.newQuantity}{' '}
                  {unitConflicts[currentConflictIndex]?.newUnit}
                </Typography>
              </Paper>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Choose which quantity and unit to use:
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => handleResolveConflict(
                    unitConflicts[currentConflictIndex].existingQuantity,
                    unitConflicts[currentConflictIndex].existingUnit
                  )}
                  fullWidth
                >
                  Keep Existing ({unitConflicts[currentConflictIndex]?.existingQuantity}{' '}
                  {unitConflicts[currentConflictIndex]?.existingUnit})
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => handleResolveConflict(
                    unitConflicts[currentConflictIndex].newQuantity,
                    unitConflicts[currentConflictIndex].newUnit
                  )}
                  fullWidth
                >
                  Use from Meal Plans ({unitConflicts[currentConflictIndex]?.newQuantity}{' '}
                  {unitConflicts[currentConflictIndex]?.newUnit})
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => handleResolveConflict(
                    unitConflicts[currentConflictIndex].existingQuantity + unitConflicts[currentConflictIndex].newQuantity,
                    unitConflicts[currentConflictIndex].existingUnit
                  )}
                  fullWidth
                >
                  Combine with Existing Unit ({unitConflicts[currentConflictIndex]?.existingQuantity + unitConflicts[currentConflictIndex]?.newQuantity}{' '}
                  {unitConflicts[currentConflictIndex]?.existingUnit})
                </Button>
              </Box>
              
              {currentConflictIndex > 0 && (
                <Button
                  onClick={handlePreviousConflict}
                  sx={{ mt: 2 }}
                >
                  ← Previous
                </Button>
              )}
            </>
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
    </AuthenticatedLayout>
  );
}
