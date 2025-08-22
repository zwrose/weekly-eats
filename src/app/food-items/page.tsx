"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback, Suspense } from "react";
import { 
  Container, 
  Typography, 
  Box, 
  CircularProgress, 
  Paper,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
  IconButton
} from "@mui/material";
import { 
  Public,
  Person,
  Edit,
  Delete
} from "@mui/icons-material";
import AuthenticatedLayout from "../../components/AuthenticatedLayout";
import { getUnitOptions } from "@/lib/food-items-utils";
import { useFoodItems } from '@/lib/hooks';
import { useSearchPagination, useDialog, useConfirmDialog, usePersistentDialog } from '@/lib/hooks';
import { responsiveDialogStyle } from '@/lib/theme';
import SearchBar from '@/components/optimized/SearchBar';
import Pagination from '@/components/optimized/Pagination';
import type { FoodItem } from '@/lib/hooks/use-food-items';
import { DialogActions, DialogTitle } from '@/components/ui';

function FoodItemsPageContent() {
  const { data: session, status } = useSession();
  const user = session?.user as { id: string; isAdmin?: boolean } | undefined;
  const isAdmin = user?.isAdmin;
  const { foodItems, loading, addFoodItem, refetch } = useFoodItems();

  // User's food items: personal items + global items created by the user
  const userFoodItems = foodItems.filter(
    item => !item.isGlobal || (item.isGlobal && item.createdBy === user?.id)
  );
  // Global food items: global items NOT created by the user
  const globalFoodItems = foodItems.filter(
    item => item.isGlobal && item.createdBy !== user?.id
  );

  // Search and pagination
  const userPagination = useSearchPagination({
    data: userFoodItems,
    itemsPerPage: 25,
    searchFields: ['name', 'singularName', 'pluralName']
  });
  const globalPagination = useSearchPagination({
    data: globalFoodItems,
    itemsPerPage: 25,
    searchFields: ['name', 'singularName', 'pluralName']
  });

  // Dialogs
  const viewDialog = usePersistentDialog('viewFoodItem');
  const deleteConfirmDialog = useConfirmDialog();
  const confirmGlobalDialog = useDialog();

  // Selected item state
  const [selectedItem, setSelectedItem] = useState<FoodItem | null>(null);
  const [editingItem, setEditingItem] = useState<Partial<FoodItem>>({});
  const [editMode, setEditMode] = useState(false);

  const itemsPerPage = 25;

  const loadFoodItems = useCallback(async () => {
    try {
      await refetch();
    } catch (error) {
      console.error('Error loading food items:', error);
    }
  }, [refetch]);

  useEffect(() => {
    if (status === 'authenticated') {
      loadFoodItems();
    }
  }, [status, loadFoodItems]);



  const handleViewItem = useCallback((item: FoodItem) => {
    setSelectedItem(item);
    setEditingItem({
      name: item.name,
      singularName: item.singularName,
      pluralName: item.pluralName,
      unit: item.unit,
      isGlobal: item.isGlobal
    });
    viewDialog.openDialog({ foodItemId: item._id });
  }, [viewDialog]);

  const handleEditItem = useCallback(() => {
    if (selectedItem?._id) {
      setEditMode(true);
      viewDialog.openDialog({ foodItemId: selectedItem._id, editMode: 'true' });
    }
  }, [selectedItem, viewDialog]);

  // Handle persistent dialog data
  useEffect(() => {
    // Only try to restore dialog state after data is loaded
    if (loading) return;
    
    if (viewDialog.open && viewDialog.data?.foodItemId && !selectedItem) {
      // Find the food item in our loaded data
      const item = [...userFoodItems, ...globalFoodItems].find(item => item._id === viewDialog.data?.foodItemId);
      if (item) {
        // Set the selected item without opening the dialog again
        setSelectedItem(item);
        setEditingItem({
          name: item.name,
          singularName: item.singularName,
          pluralName: item.pluralName,
          unit: item.unit,
          isGlobal: item.isGlobal
        });
      }
    }
    // Handle edit mode persistence
    if (viewDialog.open && viewDialog.data?.editMode === 'true' && selectedItem && !editMode) {
      setEditMode(true);
    }
  }, [viewDialog.open, viewDialog.data, selectedItem, userFoodItems, globalFoodItems, editMode, loading]);

  const handleUpdateItem = async () => {
    if (!selectedItem?._id) return;
    
    try {
      await addFoodItem({
        _id: selectedItem._id,
        name: editingItem.name || '',
        singularName: editingItem.singularName || '',
        pluralName: editingItem.pluralName || '',
        unit: editingItem.unit || '',
      });
      // Exit edit mode but keep dialog open in view mode
      setEditMode(false);
      viewDialog.openDialog({ foodItemId: selectedItem._id });
      loadFoodItems(); // Refresh the lists
    } catch (error) {
      console.error('Error updating food item:', error);
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedItem?._id) return;
    
    try {
      await deleteConfirmDialog.openDialog();
    } catch (error) {
      console.error('Error deleting food item:', error);
    }
  };

  const handleCloseViewDialog = () => {
    viewDialog.closeDialog();
    setSelectedItem(null);
    setEditMode(false);
  };

  const canDeleteItem = (item: FoodItem) => {
    if (isAdmin) return true;
    if (!item.isGlobal) return true;
    return false;
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
    return null; // Will be handled by AuthenticatedLayout
  }

  return (
    <Suspense fallback={
      <AuthenticatedLayout>
        <Container maxWidth="md">
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      </AuthenticatedLayout>
    }>
    <AuthenticatedLayout>
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Manage Food Items
        </Typography>
        
        <Paper sx={{ p: 3, mt: { xs: 2, md: 3 } }}>
          {/* Search Bar */}
          <Box sx={{ mb: 4 }}>
            <SearchBar
              value={userPagination.searchTerm}
              onChange={(value) => {
                userPagination.setSearchTerm(value);
                globalPagination.setSearchTerm(value);
              }}
              placeholder="Start typing to filter food items by name..."
            />
          </Box>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* User Food Items Section */}
              <Box sx={{ mb: 4 }}>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'column', sm: 'row' },
                  justifyContent: 'space-between', 
                  alignItems: { xs: 'flex-start', sm: 'center' }, 
                  gap: { xs: 1, sm: 0 },
                  mb: 2 
                }}>
                  <Typography variant="h6" gutterBottom>
                    <Person sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Your Food Items ({userPagination.searchTerm ? `${userPagination.totalItems}/${userFoodItems.length}` : userFoodItems.length})
                  </Typography>
                </Box>
                
                {userFoodItems.length > 0 ? (
                  <>
                    {/* Desktop Table View */}
                    <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                      <TableContainer>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ width: '65%', fontWeight: 'bold' }}>Name</TableCell>
                              <TableCell sx={{ width: '20%', fontWeight: 'bold' }}>Access Level</TableCell>
                              <TableCell sx={{ width: '15%', fontWeight: 'bold' }}>Created</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {userPagination.paginatedData.map((item) => (
                              <TableRow 
                                key={item._id}
                                onClick={() => handleViewItem(item)}
                                sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                              >
                                <TableCell>
                                  {item.name}
                                </TableCell>
                                <TableCell>
                                  {item.isGlobal ? (
                                    <Chip 
                                      label="Global" 
                                      size="small" 
                                      color="primary" 
                                      variant="outlined"
                                      icon={<Public fontSize="small" />}
                                    />
                                  ) : (
                                    <Chip 
                                      label="Personal" 
                                      size="small" 
                                      color="default" 
                                      variant="outlined"
                                      icon={<Person fontSize="small" />}
                                    />
                                  )}
                                </TableCell>
                                <TableCell>
                                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>

                    {/* Mobile Card View */}
                    <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                      {userPagination.paginatedData.map((item) => (
                        <Paper
                          key={item._id}
                          onClick={() => handleViewItem(item)}
                          sx={{
                            p: 3,
                            mb: 2,
                            cursor: 'pointer',
                            '&:hover': { 
                              backgroundColor: 'action.hover',
                              transform: 'translateY(-2px)',
                              boxShadow: 4
                            },
                            transition: 'all 0.2s ease-in-out',
                            boxShadow: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2
                          }}
                        >
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', mb: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                              {item.name}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                              {item.isGlobal ? (
                                <Chip 
                                  label="Global" 
                                  size="small" 
                                  color="primary" 
                                  variant="outlined"
                                  icon={<Public fontSize="small" />}
                                />
                              ) : (
                                <Chip 
                                  label="Personal" 
                                  size="small" 
                                  color="default" 
                                  variant="outlined"
                                  icon={<Person fontSize="small" />}
                                />
                              )}
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              Created: {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                            </Typography>
                          </Box>
                        </Paper>
                      ))}
                    </Box>
                    
                    {userFoodItems.length > itemsPerPage && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                        <Pagination
                          count={userPagination.totalPages}
                          page={userPagination.currentPage}
                          onChange={userPagination.setCurrentPage}
                        />
                      </Box>
                    )}
                  </>
                ) : (
                  <Alert severity="info">
                    {userPagination.searchTerm ? 'No user food items match your search criteria' : 'No user food items found'}
                  </Alert>
                )}
              </Box>

              {/* Global Food Items Section (Admin Only) */}
              {isAdmin && (
                <Box>
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: { xs: 'column', sm: 'row' },
                    justifyContent: 'space-between', 
                    alignItems: { xs: 'flex-start', sm: 'center' }, 
                    gap: { xs: 1, sm: 0 },
                    mb: 2 
                  }}>
                    <Typography variant="h6" gutterBottom>
                      <Public sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Global Food Items Owned By Others ({globalPagination.searchTerm ? `${globalPagination.totalItems}/${globalFoodItems.length}` : globalFoodItems.length})
                    </Typography>
                  </Box>
                  
                  {globalFoodItems.length > 0 ? (
                    <>
                      {/* Desktop Table View */}
                      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                        <TableContainer>
                          <Table>
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ width: '65%', fontWeight: 'bold' }}>Name</TableCell>
                                <TableCell sx={{ width: '20%', fontWeight: 'bold' }}>Access Level</TableCell>
                                <TableCell sx={{ width: '15%', fontWeight: 'bold' }}>Created</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {globalPagination.paginatedData.map((item) => (
                                <TableRow 
                                  key={item._id}
                                  onClick={() => handleViewItem(item)}
                                  sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                                >
                                  <TableCell>
                                    {item.name}
                                  </TableCell>
                                  <TableCell>
                                    {item.isGlobal ? (
                                      <Chip 
                                        label="Global" 
                                        size="small" 
                                        color="primary" 
                                        variant="outlined"
                                        icon={<Public fontSize="small" />}
                                      />
                                    ) : (
                                      <Chip 
                                        label="Personal" 
                                        size="small" 
                                        color="default" 
                                        variant="outlined"
                                        icon={<Person fontSize="small" />}
                                      />
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>

                      {/* Mobile Card View */}
                      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                        {globalPagination.paginatedData.map((item) => (
                          <Paper
                            key={item._id}
                            onClick={() => handleViewItem(item)}
                            sx={{
                              p: 3,
                              mb: 2,
                              cursor: 'pointer',
                              '&:hover': { 
                                backgroundColor: 'action.hover',
                                transform: 'translateY(-2px)',
                                boxShadow: 4
                              },
                              transition: 'all 0.2s ease-in-out',
                              boxShadow: 2,
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 2
                            }}
                          >
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', mb: 2 }}>
                              <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                                {item.name}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Box>
                                {item.isGlobal ? (
                                  <Chip 
                                    label="Global" 
                                    size="small" 
                                    color="primary" 
                                    variant="outlined"
                                    icon={<Public fontSize="small" />}
                                  />
                                ) : (
                                  <Chip 
                                    label="Personal" 
                                    size="small" 
                                    color="default" 
                                    variant="outlined"
                                    icon={<Person fontSize="small" />}
                                  />
                                )}
                              </Box>
                              <Typography variant="body2" color="text.secondary">
                                Created: {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                              </Typography>
                            </Box>
                          </Paper>
                        ))}
                      </Box>
                      
                      {globalFoodItems.length > itemsPerPage && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                          <Pagination
                            count={globalPagination.totalPages}
                            page={globalPagination.currentPage}
                            onChange={globalPagination.setCurrentPage}
                          />
                        </Box>
                      )}
                    </>
                  ) : (
                    <Alert severity="info">
                      {globalPagination.searchTerm ? 'No global food items match your search criteria' : 'No global food items found not owned by you'}
                    </Alert>
                  )}
                </Box>
              )}
            </>
          )}
        </Paper>
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
          actions={!editMode ? (
            <IconButton onClick={handleEditItem} color="inherit" aria-label="Edit">
              <Edit />
            </IconButton>
          ) : undefined}
        >
          <Typography variant="h6">
            {editMode ? 'Edit Food Item' : 'View Food Item'}
          </Typography>
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
                    onChange={(e) => setEditingItem({ ...editingItem, singularName: e.target.value })}
                    fullWidth
                  />
                  <TextField
                    label="Plural Name"
                    value={editingItem.pluralName || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, pluralName: e.target.value })}
                    fullWidth
                  />
                  <FormControl fullWidth>
                    <InputLabel id="unit-label">Typical Selling Unit</InputLabel>
                    <Select
                      labelId="unit-label"
                      id="unit"
                      value={editingItem.unit || ''}
                      label="Typical Selling Unit"
                      onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
                    >
                      {getUnitOptions().map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  
                  {/* Global/Personal Toggle - Only show for admins and personal items */}
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
                  
                  {/* Show current status for global items */}
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
                    <Typography variant="subtitle2" color="text.secondary">Default Name</Typography>
                    <Typography variant="body1">{selectedItem.name}</Typography>
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Singular Name</Typography>
                    <Typography variant="body1">{selectedItem.singularName}</Typography>
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Plural Name</Typography>
                    <Typography variant="body1">{selectedItem.pluralName}</Typography>
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Typical Selling Unit</Typography>
                    <Typography variant="body1">{selectedItem.unit || 'N/A'}</Typography>
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Access Level</Typography>
                    <Typography variant="body1">
                      {selectedItem.isGlobal ? 'Global' : 'Personal'}
                    </Typography>
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Created</Typography>
                    <Typography variant="body1">
                      {selectedItem.createdAt ? new Date(selectedItem.createdAt).toLocaleString() : ''}
                    </Typography>
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Last Updated</Typography>
                    <Typography variant="body1">
                      {selectedItem.updatedAt ? new Date(selectedItem.updatedAt).toLocaleString() : ''}
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
                  title={canDeleteItem(selectedItem!) ? "Delete this food item" : "Only admins can delete global items"}
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
                <Button 
                  onClick={handleUpdateItem} 
                  variant="contained"
                >
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
            Are you sure you want to delete &quot;{selectedItem?.name}&quot;? This action cannot be undone.
          </Typography>
          
          <DialogActions primaryButtonIndex={1}>
            <Button onClick={deleteConfirmDialog.closeDialog}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                deleteConfirmDialog.closeDialog();
                handleDeleteItem();
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
            Making this item global will make it available to all users. <b>This action cannot be undone</b>—once global, the item cannot be made personal again. Are you sure you want to proceed?
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
    <Suspense fallback={
      <AuthenticatedLayout>
        <Container maxWidth="md">
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      </AuthenticatedLayout>
    }>
      <FoodItemsPageContent />
    </Suspense>
  );
}