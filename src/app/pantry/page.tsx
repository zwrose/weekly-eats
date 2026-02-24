'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  Container,
  Typography,
  Box,
  Skeleton,
  Alert,
  Button,
  Dialog,
  DialogContent,
  IconButton,
} from '@mui/material';
import { Pagination as MuiPagination } from '@mui/material';
import AuthenticatedLayout from '../../components/AuthenticatedLayout';
import { PantryItemWithFoodItem, CreatePantryItemRequest } from '../../types/pantry';
import { createPantryItem, deletePantryItem } from '../../lib/pantry-utils';
import { useFoodItems, useDialog, useConfirmDialog } from '@/lib/hooks';
import { useServerPagination } from '@/lib/hooks/use-server-pagination';
import { useDebouncedSearch } from '@/lib/hooks/use-debounced-search';
import { responsiveDialogStyle } from '@/lib/theme';
import SearchBar from '@/components/optimized/SearchBar';
import Add from '@mui/icons-material/Add';
import Delete from '@mui/icons-material/Delete';
import { DialogActions, DialogTitle, ListRow, StaggeredList } from '@/components/ui';
import FoodItemAutocomplete from '@/components/food-item-inputs/FoodItemAutocomplete';
import { SearchOption } from '@/lib/hooks/use-food-item-selector';

// ── Pantry accent color ──
const PANTRY_ACCENT = '#a87bb5';

// ── Module-level sx constants ──

const paginationContainerSx = {
  display: 'flex',
  justifyContent: 'center',
  mt: 2,
} as const;

// ── Skeleton loader for in-page loading state ──

function PantryListSkeleton() {
  const widths = [60, 45, 70, 55, 65];
  return (
    <Box>
      {widths.map((w, i) => (
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
          <Skeleton variant="text" width={`${w}%`} height={20} sx={{ flex: '1 1 auto' }} />
          <Skeleton variant="circular" width={24} height={24} sx={{ flexShrink: 0, ml: 1 }} />
        </Box>
      ))}
    </Box>
  );
}

export default function PantryPage() {
  const { status } = useSession();
  const [newItem, setNewItem] = useState<CreatePantryItemRequest>({
    foodItemId: '',
  });
  const [selectedFoodItem, setSelectedFoodItem] = useState<SearchOption | null>(null);

  // Ref for Add button to focus after selection
  const addButtonRef = useRef<HTMLButtonElement>(null);

  // Dialog hooks
  const createDialog = useDialog();
  const deleteConfirmDialog = useConfirmDialog<PantryItemWithFoodItem>();

  // Food items hook (for the add dialog autocomplete)
  const { foodItems, addFoodItem } = useFoodItems();

  // Search
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useDebouncedSearch();

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
      alert('Failed to create pantry item');
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
      alert('Failed to delete pantry item');
    }
  };

  // UI
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
              <Skeleton variant="rounded" width={90} height={32} />
            </Box>
            <Skeleton variant="rounded" height={36} sx={{ mb: 2, maxWidth: 'md', mx: 'auto' }} />
            <Box sx={{ maxWidth: 'md', mx: 'auto' }}>
              <PantryListSkeleton />
            </Box>
          </Box>
        </Container>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <Container maxWidth="xl" sx={{ py: { xs: 0.5, md: 1 } }}>
        {/* Compact page header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: { xs: 1.5, md: 2 },
          }}
        >
          <Typography
            variant="h5"
            component="h1"
            sx={{ fontSize: '1.125rem', fontWeight: 600 }}
          >
            Pantry Items ({total})
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {/* Mobile: icon-only add button */}
            <IconButton
              onClick={createDialog.openDialog}
              size="small"
              sx={{
                display: { xs: 'flex', sm: 'none' },
                bgcolor: PANTRY_ACCENT,
                color: 'white',
                width: 32,
                height: 32,
                '&:hover': { bgcolor: '#956ea2' },
              }}
            >
              <Add sx={{ fontSize: 18 }} />
            </IconButton>
            {/* Desktop: full add button */}
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={createDialog.openDialog}
              size="small"
              sx={{
                display: { xs: 'none', sm: 'flex' },
                bgcolor: PANTRY_ACCENT,
                '&:hover': { bgcolor: '#956ea2' },
              }}
            >
              Add Item
            </Button>
          </Box>
        </Box>

        <Box sx={{ maxWidth: 'md', mx: 'auto' }}>
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search your pantry..."
          />

          {loading ? (
            <PantryListSkeleton />
          ) : (
            <>
              {pantryItems.length > 0 ? (
                <>
                  {/* Flat row list — unified layout for desktop and mobile */}
                  <StaggeredList>
                    {pantryItems.map((item) => (
                      <ListRow
                        key={item._id}
                        accentColor={PANTRY_ACCENT}
                        sx={{ minHeight: 40 }}
                      >
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
                          {item.foodItem.pluralName}
                        </Typography>

                        {/* Delete icon */}
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConfirmDialog.openDialog(item);
                          }}
                          sx={{
                            flexShrink: 0,
                            color: 'text.tertiary',
                            p: 0.5,
                            '&:hover': { color: 'error.main' },
                          }}
                          aria-label={`Remove ${item.foodItem.name}`}
                        >
                          <Delete sx={{ fontSize: 16 }} />
                        </IconButton>
                      </ListRow>
                    ))}
                  </StaggeredList>

                  {totalPages > 1 && (
                    <Box sx={paginationContainerSx}>
                      <MuiPagination
                        count={totalPages}
                        page={page}
                        onChange={(_e, value) => setPage(value)}
                      />
                    </Box>
                  )}
                </>
              ) : (
                <Alert severity="info">
                  {searchTerm
                    ? 'No pantry items match your search criteria'
                    : 'No pantry items found. Add your first item to get started!'}
                </Alert>
              )}
            </>
          )}
        </Box>

        {/* Add Pantry Item Dialog */}
        <Dialog
          open={createDialog.open}
          onClose={createDialog.closeDialog}
          maxWidth="xs"
          fullWidth
          sx={responsiveDialogStyle}
        >
          <DialogTitle onClose={createDialog.closeDialog}>Add Pantry Item</DialogTitle>
          <DialogContent>
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
            >
              Add
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteConfirmDialog.open}
          onClose={deleteConfirmDialog.closeDialog}
          maxWidth="xs"
          fullWidth
          sx={responsiveDialogStyle}
        >
          <DialogTitle onClose={deleteConfirmDialog.closeDialog}>Remove Pantry Item</DialogTitle>
          <DialogContent>
            Are you sure you want to remove {deleteConfirmDialog.data?.foodItem.name} from your
            pantry?
          </DialogContent>
          <DialogActions primaryButtonIndex={1}>
            <Button onClick={deleteConfirmDialog.cancel}>Cancel</Button>
            <Button onClick={handleDeleteItem} color="error" variant="contained">
              Remove
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </AuthenticatedLayout>
  );
}
