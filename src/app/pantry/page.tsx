'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Button,
  Dialog,
  DialogContent,
  Pagination as MuiPagination,
  Snackbar,
  Alert,
} from '@mui/material';
import AuthenticatedLayout from '../../components/AuthenticatedLayout';
import { PantryItemWithFoodItem, CreatePantryItemRequest } from '../../types/pantry';
import { createPantryItem, deletePantryItem } from '../../lib/pantry-utils';
import { useFoodItems, useDialog, useConfirmDialog } from '@/lib/hooks';
import { useServerPagination } from '@/lib/hooks/use-server-pagination';
import { useDebouncedSearch } from '@/lib/hooks/use-debounced-search';
import { responsiveDialogStyle } from '@/lib/theme';
import { tokens } from '@/lib/design-tokens';
import SearchBar from '@/components/optimized/SearchBar';
import { DialogActions, DialogTitle, ConfirmDialog } from '@/components/ui';
import FoodItemAutocomplete from '@/components/food-item-inputs/FoodItemAutocomplete';
import { SearchOption } from '@/lib/hooks/use-food-item-selector';
import { PantryListView } from '@/components/pantry/PantryListView';

export default function PantryPage() {
  const { status } = useSession();
  const [newItem, setNewItem] = useState<CreatePantryItemRequest>({
    foodItemId: '',
  });
  const [selectedFoodItem, setSelectedFoodItem] = useState<SearchOption | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'error' | 'info' | 'success';
  }>({ open: false, message: '', severity: 'info' });

  // Ref for Add button to focus after selection
  const addButtonRef = useRef<HTMLButtonElement>(null);

  // Dialog hooks
  const createDialog = useDialog();
  const deleteConfirmDialog = useConfirmDialog<PantryItemWithFoodItem>();

  // Food items hook (for the add dialog autocomplete)
  const { foodItems, addFoodItem } = useFoodItems();

  // Search
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useDebouncedSearch();

  const showSnackbar = (message: string, severity: 'error' | 'info' | 'success' = 'info') => {
    setSnackbar({ open: true, message, severity });
  };
  const handleCloseSnackbar = () => setSnackbar((s) => ({ ...s, open: false }));

  // Compute filterKey for useServerPagination
  const filterKey = useMemo(
    () => JSON.stringify({ q: debouncedSearchTerm }),
    [debouncedSearchTerm]
  );

  // Server-paginated data fetching
  const fetchPantryItems = useCallback(
    async (params: { page: number; limit: number; sortBy: string; sortOrder: 'asc' | 'desc' }) => {
      const sp = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      });
      if (debouncedSearchTerm) sp.set('query', debouncedSearchTerm);

      const response = await fetch(`/api/pantry?${sp.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch pantry items');
      return response.json();
    },
    [debouncedSearchTerm]
  );

  const {
    data: pantryItems,
    total,
    page,
    totalPages,
    loading,
    setPage,
    refetch,
  } = useServerPagination<PantryItemWithFoodItem>({
    fetchFn: fetchPantryItems,
    filterKey,
    defaultSortBy: 'foodItem.name',
    defaultSortOrder: 'asc',
  });

  // Handlers
  const handleCreateItem = async () => {
    try {
      await createPantryItem(newItem);
      createDialog.closeDialog();
      setNewItem({ foodItemId: '' });
      setSelectedFoodItem(null);
      refetch();
    } catch (error) {
      console.error('Error creating pantry item:', error);
      showSnackbar('Failed to add pantry item', 'error');
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteConfirmDialog.data?._id) return;
    try {
      await deletePantryItem(deleteConfirmDialog.data._id);
      deleteConfirmDialog.closeDialog();
      refetch();
    } catch (error) {
      console.error('Error deleting pantry item:', error);
      showSnackbar('Failed to remove pantry item', 'error');
    }
  };

  // UI
  if (status === 'loading') {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      </AuthenticatedLayout>
    );
  }

  const viewItems = loading
    ? []
    : pantryItems.map((item) => ({ _id: item._id, name: item.foodItem.pluralName }));

  const emptyMessage = loading ? (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
      <CircularProgress />
    </Box>
  ) : (
    <Box
      sx={{
        bgcolor: tokens.surface.raised,
        border: `1px solid ${tokens.border.subtle}`,
        borderRadius: `${tokens.radius.xl}px`,
        py: 4,
        px: 3,
        textAlign: 'center',
        color: tokens.text.secondary,
        fontSize: 14,
      }}
    >
      {searchTerm
        ? 'No pantry items match your search'
        : 'No pantry items yet. Add your first item to get started.'}
    </Box>
  );

  return (
    <AuthenticatedLayout>
      <Container maxWidth="md" sx={{ py: { xs: 0.5, md: 1 } }}>
        <PantryListView
          items={viewItems}
          total={total}
          onAddItem={createDialog.openDialog}
          onDeleteItem={(id) => {
            const item = pantryItems.find((p) => p._id === id);
            if (item) deleteConfirmDialog.openDialog(item);
          }}
          search={
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search your pantry..."
            />
          }
          pagination={
            totalPages > 1 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <MuiPagination
                  count={totalPages}
                  page={page}
                  onChange={(_e, value) => setPage(value)}
                />
              </Box>
            ) : undefined
          }
          emptyMessage={emptyMessage}
        />

        {/* Add Pantry Item Dialog */}
        <Dialog
          open={createDialog.open}
          onClose={createDialog.closeDialog}
          maxWidth="xs"
          fullWidth
          sx={responsiveDialogStyle}
          slotProps={{
            paper: {
              sx: {
                // Edge-to-edge full-screen on phones (responsiveDialogStyle sets width/height
                // 100% on xs, but maxWidth="xs" would otherwise cap width on >444px phones).
                maxWidth: { xs: '100%', sm: 460 },
                bgcolor: tokens.surface.raised,
                border: `1px solid ${tokens.border.strong}`,
                borderRadius: { sm: `${tokens.radius.xxxl}px` },
              },
            },
          }}
        >
          <DialogTitle onClose={createDialog.closeDialog}>Add pantry item</DialogTitle>
          <DialogContent>
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: tokens.text.secondary,
                mb: 1,
                mt: 1,
              }}
            >
              Food item
            </Typography>
            <FoodItemAutocomplete
              allowRecipes={false}
              excludeIds={pantryItems.map((item) => item.foodItem._id)}
              excludedItemLabel="Already in pantry"
              foodItems={foodItems}
              autoLoad={false}
              value={selectedFoodItem}
              autoFocus={true}
              onChange={(item) => {
                if (item && item.type === 'foodItem') {
                  setSelectedFoodItem(item);
                  setNewItem({ foodItemId: item._id });
                  setTimeout(() => {
                    addButtonRef.current?.focus();
                  }, 100);
                } else {
                  setSelectedFoodItem(null);
                  setNewItem({ foodItemId: '' });
                }
              }}
              onFoodItemAdded={async (newFoodItem) => {
                addFoodItem(newFoodItem);
                const searchOption: SearchOption = {
                  ...newFoodItem,
                  type: 'foodItem' as const,
                };
                setSelectedFoodItem(searchOption);
                setNewItem({ foodItemId: newFoodItem._id });
              }}
              onCreateItem={(newFoodItem) => {
                const searchOption: SearchOption = {
                  ...newFoodItem,
                  type: 'foodItem' as const,
                };
                setSelectedFoodItem(searchOption);
                setNewItem({ foodItemId: newFoodItem._id });
              }}
              label="Food Item"
              size="small"
              fullWidth
            />
          </DialogContent>
          <DialogActions primaryButtonIndex={1}>
            <Button onClick={createDialog.closeDialog}>Cancel</Button>
            <Button
              ref={addButtonRef}
              onClick={handleCreateItem}
              disabled={!newItem.foodItemId}
              variant="contained"
              sx={{ color: tokens.onAccent.pantry }}
            >
              Add
            </Button>
          </DialogActions>
        </Dialog>

        {/* Remove Confirmation */}
        <ConfirmDialog
          open={deleteConfirmDialog.open}
          title="Remove pantry item"
          body={
            <>
              Are you sure you want to remove <b>{deleteConfirmDialog.data?.foodItem.name}</b> from
              your pantry?
            </>
          }
          confirmLabel="Remove"
          confirmColor="error"
          onConfirm={handleDeleteItem}
          onCancel={deleteConfirmDialog.cancel}
        />

        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled">
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </AuthenticatedLayout>
  );
}
