'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import {
  Container,
  Typography,
  Box,
  Skeleton,
  TextField,
  Alert,
  Chip,
  Button,
  Dialog,
  DialogContent,
  Tooltip,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Switch,
  IconButton,
  Drawer,
} from '@mui/material';
import { Public, Person, Edit, Delete, IosShare, FilterList, Close } from '@mui/icons-material';
import { Pagination as MuiPagination } from '@mui/material';
import AuthenticatedLayout from '../../components/AuthenticatedLayout';
import { getUnitOptions } from '@/lib/food-items-utils';
import { useDialog, useConfirmDialog, usePersistentDialog } from '@/lib/hooks';
import { useServerPagination } from '@/lib/hooks/use-server-pagination';
import { useDebouncedSearch } from '@/lib/hooks/use-debounced-search';
import { responsiveDialogStyle } from '@/lib/theme';
import { DialogActions, DialogTitle, ListRow, StaggeredList } from '@/components/ui';

interface FoodItemWithAccessLevel {
  _id: string;
  name: string;
  singularName: string;
  pluralName: string;
  unit: string;
  isGlobal?: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  accessLevel: 'private' | 'shared-by-you' | 'shared-by-others';
}

const accessLevelChipProps = {
  private: { label: 'Private', color: 'default' as const, icon: <Person fontSize="small" /> },
  'shared-by-you': {
    label: 'Shared by You',
    color: 'info' as const,
    icon: <IosShare fontSize="small" />,
  },
  'shared-by-others': {
    label: 'Shared by Others',
    color: 'primary' as const,
    icon: <Public fontSize="small" />,
  },
} as const;

const accessLevelOptions = [
  { value: 'all', label: 'All' },
  { value: 'private', label: 'Private' },
  { value: 'shared-by-you', label: 'Shared by You' },
  { value: 'shared-by-others', label: 'Shared by Others' },
] as const;

// ── Module-level sx constants ──

const tinyChipSx = {
  fontSize: '0.6875rem',
  height: 18,
  '& .MuiChip-label': { px: 0.75 },
  '& .MuiChip-icon': { fontSize: 12, ml: 0.25 },
} as const;

const paginationContainerSx = {
  display: 'flex',
  justifyContent: 'center',
  mt: 2,
} as const;

// ── Skeleton loader for in-page loading state ──

function FoodItemsListSkeleton() {
  const widths = [65, 50, 75, 55, 60, 70, 45, 58];
  return (
    <Box>
      {widths.map((w, i) => (
        <Box
          key={i}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            minHeight: 36,
            px: 1.5,
            py: 1,
            borderBottom: '1px solid',
            borderBottomColor: 'divider',
          }}
        >
          <Skeleton variant="text" width={`${w}%`} height={20} sx={{ flex: '1 1 auto' }} />
          <Skeleton variant="rounded" width={60} height={18} sx={{ borderRadius: '9px', flexShrink: 0 }} />
          <Skeleton variant="text" width={70} height={16} sx={{ flexShrink: 0 }} />
        </Box>
      ))}
    </Box>
  );
}

function FoodItemsPageContent() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.isAdmin;

  // Search
  const { searchTerm, debouncedSearchTerm, setSearchTerm, clearSearch } = useDebouncedSearch();

  // Filter state
  const [accessLevel, setAccessLevel] = useState<string>('all');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const hasActiveFilters = searchTerm !== '' || accessLevel !== 'all';

  const handleClearFilters = useCallback(() => {
    clearSearch();
    setAccessLevel('all');
  }, [clearSearch]);

  // Compute filterKey for useServerPagination
  const filterKey = useMemo(
    () => JSON.stringify({ q: debouncedSearchTerm, al: accessLevel }),
    [debouncedSearchTerm, accessLevel]
  );

  // Server-paginated data fetching
  const fetchFoodItems = useCallback(
    async (params: { page: number; limit: number; sortBy: string; sortOrder: 'asc' | 'desc' }) => {
      const sp = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
      });
      if (debouncedSearchTerm) sp.set('query', debouncedSearchTerm);
      if (accessLevel !== 'all') sp.set('accessLevel', accessLevel);

      const response = await fetch(`/api/food-items?${sp.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch food items');
      return response.json();
    },
    [debouncedSearchTerm, accessLevel]
  );

  const {
    data: foodItems,
    total,
    page,
    totalPages,
    loading,
    setPage,
    refetch,
  } = useServerPagination<FoodItemWithAccessLevel>({
    fetchFn: fetchFoodItems,
    filterKey,
    defaultSortBy: 'name',
    defaultSortOrder: 'asc',
  });

  // Dialogs
  const viewDialog = usePersistentDialog('viewFoodItem');
  const deleteConfirmDialog = useConfirmDialog();
  const confirmGlobalDialog = useDialog();

  // Selected item state
  const [selectedItem, setSelectedItem] = useState<FoodItemWithAccessLevel | null>(null);
  const [editingItem, setEditingItem] = useState<Partial<FoodItemWithAccessLevel>>({});
  const [editMode, setEditMode] = useState(false);

  const handleViewItem = useCallback(
    (item: FoodItemWithAccessLevel) => {
      setSelectedItem(item);
      setEditingItem({
        name: item.name,
        singularName: item.singularName,
        pluralName: item.pluralName,
        unit: item.unit,
        isGlobal: item.isGlobal,
      });
      viewDialog.openDialog({ foodItemId: item._id });
    },
    [viewDialog]
  );

  const handleEditItem = useCallback(() => {
    if (selectedItem?._id) {
      setEditMode(true);
      viewDialog.openDialog({ foodItemId: selectedItem._id, editMode: 'true' });
    }
  }, [selectedItem, viewDialog]);

  // Handle persistent dialog data restoration
  useEffect(() => {
    if (loading) return;

    if (viewDialog.open && viewDialog.data?.foodItemId && !selectedItem) {
      const item = foodItems.find((fi) => fi._id === viewDialog.data?.foodItemId);
      if (item) {
        setSelectedItem(item);
        setEditingItem({
          name: item.name,
          singularName: item.singularName,
          pluralName: item.pluralName,
          unit: item.unit,
          isGlobal: item.isGlobal,
        });
      }
    }
    if (viewDialog.open && viewDialog.data?.editMode === 'true' && selectedItem && !editMode) {
      setEditMode(true);
    }
  }, [viewDialog.open, viewDialog.data, selectedItem, foodItems, editMode, loading]);

  const handleUpdateItem = async () => {
    if (!selectedItem?._id) return;

    if (!editingItem.name || !editingItem.name.trim()) {
      alert('Name is required');
      return;
    }

    try {
      const updateData: {
        name: string;
        singularName: string;
        pluralName: string;
        unit: string;
        isGlobal?: boolean;
      } = {
        name: editingItem.name.trim(),
        singularName: editingItem.singularName?.trim() || editingItem.name.trim(),
        pluralName: editingItem.pluralName?.trim() || editingItem.name.trim(),
        unit: editingItem.unit || '',
      };

      if (editingItem.isGlobal !== undefined) {
        updateData.isGlobal = editingItem.isGlobal;
      }

      const response = await fetch(`/api/food-items/${selectedItem._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to update food item (${response.status})`);
      }

      const updatedItem = await response.json();

      setSelectedItem(updatedItem);
      setEditingItem({
        name: updatedItem.name,
        singularName: updatedItem.singularName,
        pluralName: updatedItem.pluralName,
        unit: updatedItem.unit,
        isGlobal: updatedItem.isGlobal,
      });

      setEditMode(false);
      viewDialog.removeDialogData('editMode');
      viewDialog.openDialog({ foodItemId: updatedItem._id });

      refetch();
    } catch (error) {
      console.error('Error updating food item:', error);
      alert(error instanceof Error ? error.message : 'Failed to update food item');
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedItem?._id) return;

    try {
      const response = await fetch(`/api/food-items/${selectedItem._id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to delete food item (${response.status})`);
      }

      handleCloseViewDialog();
      await refetch();
    } catch (error) {
      console.error('Error deleting food item:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete food item');
    }
  };

  const handleCloseViewDialog = () => {
    viewDialog.closeDialog();
    setSelectedItem(null);
    setEditMode(false);
  };

  const canDeleteItem = (item: FoodItemWithAccessLevel) => {
    if (isAdmin) return true;
    if (!item.isGlobal) return true;
    return false;
  };

  // Show loading state while session is being fetched
  if (status === 'loading') {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="xl">
          <Box sx={{ py: { xs: 0.5, md: 1 } }}>
            <Skeleton variant="text" width={120} height={28} sx={{ mb: 2 }} />
            <Skeleton variant="rounded" height={36} sx={{ mb: 2 }} />
            <FoodItemsListSkeleton />
          </Box>
        </Container>
      </AuthenticatedLayout>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <Suspense
      fallback={
        <AuthenticatedLayout>
          <Container maxWidth="xl">
            <Box sx={{ py: { xs: 0.5, md: 1 } }}>
              <Skeleton variant="text" width={120} height={28} sx={{ mb: 2 }} />
              <Skeleton variant="rounded" height={36} sx={{ mb: 2 }} />
              <FoodItemsListSkeleton />
            </Box>
          </Container>
        </AuthenticatedLayout>
      }
    >
      <AuthenticatedLayout>
        <Container maxWidth="xl">
          <Box sx={{ py: { xs: 0.5, md: 1 } }}>
            {/* Compact page header */}
            <Typography
              variant="h5"
              component="h1"
              sx={{ fontSize: '1.125rem', fontWeight: 600, mb: { xs: 1.5, md: 2 } }}
            >
              Food Items
            </Typography>

            {/* Desktop: Search + Filters */}
            <Box
              sx={{
                display: { xs: 'none', md: 'flex' },
                gap: 2,
                mb: 2,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <TextField
                size="small"
                placeholder="Search food items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoComplete="off"
                sx={{ flex: 1, minWidth: 200 }}
              />
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel id="access-level-label">Access Level</InputLabel>
                <Select
                  labelId="access-level-label"
                  value={accessLevel}
                  label="Access Level"
                  onChange={(e) => setAccessLevel(e.target.value)}
                >
                  {accessLevelOptions.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {hasActiveFilters && (
                <Button size="small" onClick={handleClearFilters}>
                  Clear Filters
                </Button>
              )}
            </Box>

            {/* Mobile: Search + Filter button */}
            <Box sx={{ display: { xs: 'flex', md: 'none' }, gap: 1, mb: 1.5, alignItems: 'center' }}>
              <TextField
                size="small"
                placeholder="Search food items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoComplete="off"
                sx={{ flex: 1 }}
              />
              <IconButton
                onClick={() => setFilterDrawerOpen(true)}
                color={accessLevel !== 'all' ? 'primary' : 'default'}
                aria-label="Open filters"
              >
                <FilterList />
              </IconButton>
            </Box>

            {/* Mobile filter drawer */}
            <Drawer
              anchor="right"
              open={filterDrawerOpen}
              onClose={() => setFilterDrawerOpen(false)}
              sx={{ '& .MuiDrawer-paper': { width: '85%', maxWidth: 360, p: 3 } }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2,
                }}
              >
                <Typography variant="h6">Filters</Typography>
                <IconButton onClick={() => setFilterDrawerOpen(false)} aria-label="Close filters">
                  <Close />
                </IconButton>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <FormControl size="small" fullWidth sx={{ mb: 2 }}>
                <InputLabel id="access-level-label-mobile">Access Level</InputLabel>
                <Select
                  labelId="access-level-label-mobile"
                  value={accessLevel}
                  label="Access Level"
                  onChange={(e) => setAccessLevel(e.target.value)}
                >
                  {accessLevelOptions.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {hasActiveFilters && (
                <Button
                  size="small"
                  fullWidth
                  onClick={() => {
                    handleClearFilters();
                    setFilterDrawerOpen(false);
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </Drawer>

            {loading ? (
              <FoodItemsListSkeleton />
            ) : (
              <>
                {/* Summary */}
                {total > 0 && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1, fontSize: '0.75rem' }}
                  >
                    {total} food item{total !== 1 ? 's' : ''} found
                  </Typography>
                )}

                {foodItems.length > 0 ? (
                  <>
                    {/* Flat row list — unified layout for desktop and mobile */}
                    <StaggeredList>
                      {foodItems.map((item) => {
                        const chipProps = accessLevelChipProps[item.accessLevel];
                        return (
                          <ListRow
                            key={item._id}
                            onClick={() => handleViewItem(item)}
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
                              {item.name}
                            </Typography>

                            {/* Access level badge (tiny chip) */}
                            <Chip
                              label={chipProps.label}
                              size="small"
                              color={chipProps.color}
                              variant="outlined"
                              icon={chipProps.icon}
                              sx={tinyChipSx}
                            />

                            {/* Date */}
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                flexShrink: 0,
                                width: { xs: 'auto', md: 90 },
                                textAlign: 'right',
                                fontSize: '0.75rem',
                                display: { xs: 'none', sm: 'block' },
                              }}
                            >
                              {item.createdAt
                                ? new Date(item.createdAt).toLocaleDateString()
                                : ''}
                            </Typography>
                          </ListRow>
                        );
                      })}
                    </StaggeredList>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <Box sx={paginationContainerSx}>
                        <MuiPagination
                          count={totalPages}
                          page={page}
                          onChange={(_, newPage) => setPage(newPage)}
                        />
                      </Box>
                    )}
                  </>
                ) : (
                  <Alert severity="info">
                    {hasActiveFilters ? 'No food items match your search' : 'No food items found'}
                  </Alert>
                )}
              </>
            )}
          </Box>
        </Container>

        {/* View/Edit Dialog */}
        <Dialog
          open={viewDialog.open}
          onClose={handleCloseViewDialog}
          maxWidth="lg"
          fullWidth
          sx={responsiveDialogStyle}
        >
          <DialogTitle
            onClose={handleCloseViewDialog}
            actions={
              !editMode ? (
                <IconButton onClick={handleEditItem} color="inherit" aria-label="Edit">
                  <Edit />
                </IconButton>
              ) : undefined
            }
          >
            <Typography variant="h6">{editMode ? 'Edit Food Item' : 'View Food Item'}</Typography>
          </DialogTitle>
          <DialogContent>
            {selectedItem && (
              <Box sx={{ mt: 2 }}>
                {editMode ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                      label="Default Name"
                      value={editingItem.name || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                      fullWidth
                    />
                    <TextField
                      label="Singular Name"
                      value={editingItem.singularName || ''}
                      onChange={(e) =>
                        setEditingItem({ ...editingItem, singularName: e.target.value })
                      }
                      fullWidth
                    />
                    <TextField
                      label="Plural Name"
                      value={editingItem.pluralName || ''}
                      onChange={(e) =>
                        setEditingItem({ ...editingItem, pluralName: e.target.value })
                      }
                      fullWidth
                    />
                    <FormControl fullWidth>
                      <InputLabel id="unit-label">Typical Usage Unit</InputLabel>
                      <Select
                        labelId="unit-label"
                        id="unit"
                        value={editingItem.unit || ''}
                        label="Typical Usage Unit"
                        onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
                      >
                        {getUnitOptions().map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {isAdmin && selectedItem && !selectedItem.isGlobal && (
                      <FormControlLabel
                        control={
                          <Switch
                            checked={editingItem.isGlobal || false}
                            onChange={(e) => {
                              if (e.target.checked) {
                                confirmGlobalDialog.openDialog();
                              } else {
                                setEditingItem({ ...editingItem, isGlobal: false });
                              }
                            }}
                            color="primary"
                          />
                        }
                        label="Make this item global (available to all users)"
                      />
                    )}

                    {selectedItem && selectedItem.isGlobal && (
                      <Box sx={{ p: 2, bgcolor: 'primary.light', borderRadius: 1 }}>
                        <Typography variant="body2" color="primary.contrastText">
                          This is a global item and cannot be made personal.
                        </Typography>
                      </Box>
                    )}
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Default Name
                      </Typography>
                      <Typography variant="body1">{selectedItem.name}</Typography>
                    </Box>
                    <Divider />
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Singular Name
                      </Typography>
                      <Typography variant="body1">{selectedItem.singularName}</Typography>
                    </Box>
                    <Divider />
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Plural Name
                      </Typography>
                      <Typography variant="body1">{selectedItem.pluralName}</Typography>
                    </Box>
                    <Divider />
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Typical Usage Unit
                      </Typography>
                      <Typography variant="body1">{selectedItem.unit || 'N/A'}</Typography>
                    </Box>
                    <Divider />
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                        Access Level
                      </Typography>
                      <Chip
                        label={
                          accessLevelChipProps[selectedItem.accessLevel]?.label ||
                          selectedItem.accessLevel
                        }
                        size="small"
                        color={accessLevelChipProps[selectedItem.accessLevel]?.color || 'default'}
                        variant="outlined"
                        icon={accessLevelChipProps[selectedItem.accessLevel]?.icon}
                      />
                    </Box>
                    <Divider />
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Created
                      </Typography>
                      <Typography variant="body1">
                        {selectedItem.createdAt
                          ? new Date(selectedItem.createdAt).toLocaleString()
                          : ''}
                      </Typography>
                    </Box>
                    <Divider />
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Last Updated
                      </Typography>
                      <Typography variant="body1">
                        {selectedItem.updatedAt
                          ? new Date(selectedItem.updatedAt).toLocaleString()
                          : ''}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>
            )}

            <DialogActions primaryButtonIndex={2}>
              {editMode ? (
                <>
                  <Button
                    onClick={() => {
                      setEditMode(false);
                      viewDialog.removeDialogData('editMode');
                      setEditingItem({});
                    }}
                  >
                    Cancel
                  </Button>
                  <Tooltip
                    title={
                      canDeleteItem(selectedItem!)
                        ? 'Delete this food item'
                        : 'Only admins can delete global items'
                    }
                    placement="top"
                  >
                    <span>
                      <Button
                        onClick={() => deleteConfirmDialog.openDialog()}
                        startIcon={<Delete />}
                        color="error"
                        disabled={!canDeleteItem(selectedItem!)}
                      >
                        Delete
                      </Button>
                    </span>
                  </Tooltip>
                  <Button onClick={handleUpdateItem} variant="contained">
                    Save
                  </Button>
                </>
              ) : null}
            </DialogActions>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteConfirmDialog.open}
          onClose={deleteConfirmDialog.closeDialog}
          sx={responsiveDialogStyle}
        >
          <DialogTitle onClose={deleteConfirmDialog.closeDialog}>Confirm Delete</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete &quot;{selectedItem?.name}&quot;? This action cannot
              be undone.
            </Typography>

            <DialogActions primaryButtonIndex={1}>
              <Button onClick={deleteConfirmDialog.closeDialog}>Cancel</Button>
              <Button
                onClick={async () => {
                  deleteConfirmDialog.closeDialog();
                  await handleDeleteItem();
                }}
                color="error"
                variant="contained"
              >
                Delete
              </Button>
            </DialogActions>
          </DialogContent>
        </Dialog>

        {/* Confirmation Dialog for making global */}
        <Dialog
          open={confirmGlobalDialog.open}
          onClose={confirmGlobalDialog.closeDialog}
          sx={responsiveDialogStyle}
        >
          <DialogTitle onClose={confirmGlobalDialog.closeDialog}>Confirm Make Global</DialogTitle>
          <DialogContent>
            <Typography>
              Making this item global will make it available to all users.{' '}
              <b>This action cannot be undone</b>—once global, the item cannot be made personal
              again. Are you sure you want to proceed?
            </Typography>
            <DialogActions primaryButtonIndex={1}>
              <Button onClick={confirmGlobalDialog.closeDialog}>Cancel</Button>
              <Button
                onClick={() => {
                  setEditingItem((prev) => ({ ...prev, isGlobal: true }));
                  confirmGlobalDialog.closeDialog();
                }}
                color="primary"
                variant="contained"
              >
                Yes, Make Global
              </Button>
            </DialogActions>
          </DialogContent>
        </Dialog>
      </AuthenticatedLayout>
    </Suspense>
  );
}

export default function FoodItemsPage() {
  return (
    <Suspense
      fallback={
        <AuthenticatedLayout>
          <Container maxWidth="xl">
            <Box sx={{ py: { xs: 0.5, md: 1 } }}>
              <Skeleton variant="text" width={120} height={28} sx={{ mb: 2 }} />
              <Skeleton variant="rounded" height={36} sx={{ mb: 2 }} />
              <FoodItemsListSkeleton />
            </Box>
          </Container>
        </AuthenticatedLayout>
      }
    >
      <FoodItemsPageContent />
    </Suspense>
  );
}
