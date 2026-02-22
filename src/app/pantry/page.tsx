'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Paper,
  Alert,
  Button,
  Dialog,
  DialogContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
import Kitchen from '@mui/icons-material/Kitchen';
import Add from '@mui/icons-material/Add';
import Delete from '@mui/icons-material/Delete';
import { DialogActions, DialogTitle } from '@/components/ui';
import FoodItemAutocomplete from '@/components/food-item-inputs/FoodItemAutocomplete';
import { SearchOption } from '@/lib/hooks/use-food-item-selector';

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
        <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <Container maxWidth="xl" sx={{ py: { xs: 0.5, md: 1 } }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: { xs: 2, sm: 0 },
            mb: { xs: 2, md: 4 },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Kitchen sx={{ fontSize: 40, color: '#9c27b0' }} />
            <Typography variant="h3" component="h1" sx={{ color: '#9c27b0' }}>
              Pantry Items ({total})
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={createDialog.openDialog}
            sx={{
              bgcolor: '#9c27b0',
              color: '#fff',
              '&:hover': { bgcolor: '#7b1fa2' },
              minWidth: { xs: '100%', sm: 'auto' },
            }}
          >
            Add Item
          </Button>
        </Box>

        <Paper sx={{ p: 3, mb: 4, maxWidth: 'md', mx: 'auto' }}>
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search your pantry..."
          />

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {pantryItems.length > 0 ? (
                <>
                  {/* Desktop Table View */}
                  <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell
                              sx={{
                                width: '70%',
                                fontWeight: 'bold',
                                wordWrap: 'break-word',
                              }}
                            >
                              Food Item
                            </TableCell>
                            <TableCell
                              align="center"
                              sx={{
                                width: '30%',
                                fontWeight: 'bold',
                                wordWrap: 'break-word',
                              }}
                            >
                              Delete
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {pantryItems.map((item) => (
                            <TableRow
                              key={item._id}
                              sx={{
                                '&:hover': { backgroundColor: 'action.hover' },
                              }}
                            >
                              <TableCell sx={{ wordWrap: 'break-word' }}>
                                <Typography variant="body1">{item.foodItem.pluralName}</Typography>
                              </TableCell>
                              <TableCell align="center" sx={{ wordWrap: 'break-word' }}>
                                <IconButton
                                  color="error"
                                  size="small"
                                  onClick={() => deleteConfirmDialog.openDialog(item)}
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>

                  {/* Mobile Card View */}
                  <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                    {pantryItems.map((item) => (
                      <Paper
                        key={item._id}
                        sx={{
                          p: 3,
                          mb: 2,
                          boxShadow: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          '&:hover': {
                            backgroundColor: 'action.hover',
                            transform: 'translateY(-2px)',
                            boxShadow: 4,
                          },
                          transition: 'all 0.2s ease-in-out',
                        }}
                      >
                        <Typography variant="subtitle1">{item.foodItem.pluralName}</Typography>
                        <IconButton
                          color="error"
                          size="small"
                          onClick={() => deleteConfirmDialog.openDialog(item)}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Paper>
                    ))}
                  </Box>

                  {totalPages > 1 && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
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
        </Paper>

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
