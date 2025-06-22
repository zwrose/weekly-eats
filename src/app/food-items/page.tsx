"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
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
  Pagination,
  Alert,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  Tooltip,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Switch
} from "@mui/material";
import { 
  Public,
  Person,
  Edit,
  Delete
} from "@mui/icons-material";
import AuthenticatedLayout from "../../components/AuthenticatedLayout";
import { getUnitOptions } from "@/lib/food-items-utils";

interface FoodItem {
  _id: string;
  name: string;
  singularName: string;
  pluralName: string;
  unit?: string;
  isGlobal: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export default function FoodItemsPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [userFoodItems, setUserFoodItems] = useState<FoodItem[]>([]);
  const [globalFoodItems, setGlobalFoodItems] = useState<FoodItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [globalPage, setGlobalPage] = useState(1);
  const [userLoading, setUserLoading] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FoodItem | null>(null);
  const [editingItem, setEditingItem] = useState<Partial<FoodItem>>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [confirmGlobalDialogOpen, setConfirmGlobalDialogOpen] = useState(false);

  const itemsPerPage = 25;
  const isAdmin = (session?.user as { isAdmin?: boolean })?.isAdmin;

  const loadFoodItems = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadUserFoodItems(),
        isAdmin ? loadGlobalFoodItems() : Promise.resolve()
      ]);
    } catch (error) {
      console.error('Error loading food items:', error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (status === 'authenticated') {
      loadFoodItems();
    }
  }, [status, loadFoodItems]);

  const loadUserFoodItems = async () => {
    try {
      setUserLoading(true);
      const response = await fetch('/api/food-items?userOnly=true');
      if (!response.ok) {
        throw new Error('Failed to fetch user food items');
      }
      const items = await response.json();
      setUserFoodItems(items);
    } catch (error) {
      console.error('Error loading user food items:', error);
    } finally {
      setUserLoading(false);
    }
  };

  const loadGlobalFoodItems = async () => {
    try {
      setGlobalLoading(true);
      const response = await fetch('/api/food-items?globalOnly=true&excludeUserCreated=true');
      if (!response.ok) {
        throw new Error('Failed to fetch global food items');
      }
      const items = await response.json();
      setGlobalFoodItems(items);
    } catch (error) {
      console.error('Error loading global food items:', error);
    } finally {
      setGlobalLoading(false);
    }
  };

  // Filter food items based on search term
  const filteredUserFoodItems = userFoodItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.singularName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.pluralName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredGlobalFoodItems = globalFoodItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.singularName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.pluralName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination
  const paginatedUserFoodItems = filteredUserFoodItems.slice(
    (userPage - 1) * itemsPerPage,
    userPage * itemsPerPage
  );

  const paginatedGlobalFoodItems = filteredGlobalFoodItems.slice(
    (globalPage - 1) * itemsPerPage,
    globalPage * itemsPerPage
  );

  // Reset pagination when search term changes
  useEffect(() => {
    setUserPage(1);
    setGlobalPage(1);
  }, [searchTerm]);

  const handleViewItem = (item: FoodItem) => {
    setSelectedItem(item);
    setEditingItem({
      name: item.name,
      singularName: item.singularName,
      pluralName: item.pluralName,
      unit: item.unit,
      isGlobal: item.isGlobal
    });
    setViewDialogOpen(true);
    setEditMode(false);
  };

  const handleEditItem = () => {
    setEditMode(true);
  };

  const handleUpdateItem = async () => {
    if (!selectedItem?._id) return;
    
    try {
      const response = await fetch(`/api/food-items/${selectedItem._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingItem.name,
          singularName: editingItem.singularName,
          pluralName: editingItem.pluralName,
          unit: editingItem.unit,
          isGlobal: editingItem.isGlobal
        })
      });
      
      if (response.ok) {
        setEditMode(false);
        setViewDialogOpen(false);
        setSelectedItem(null);
        loadFoodItems(); // Refresh the lists
      } else {
        const errorData = await response.json();
        console.error('Error updating food item:', errorData.error);
        // You could add a toast notification here to show the error to the user
      }
    } catch (error) {
      console.error('Error updating food item:', error);
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedItem?._id) return;
    
    try {
      const response = await fetch(`/api/food-items/${selectedItem._id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setDeleteConfirmOpen(false);
        setViewDialogOpen(false);
        setSelectedItem(null);
        loadFoodItems(); // Refresh the lists
      }
    } catch (error) {
      console.error('Error deleting food item:', error);
    }
  };

  const handleCloseViewDialog = () => {
    setViewDialogOpen(false);
    setSelectedItem(null);
    setEditMode(false);
  };

  const canDeleteItem = (item: FoodItem) => {
    if (isAdmin) return true; // Admins can delete anything
    if (!item.isGlobal) return true; // Non-admins can delete their personal items
    return false; // Non-admins cannot delete global items
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
    <AuthenticatedLayout>
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Manage Food Items
        </Typography>
        
        <Paper sx={{ p: 3, mt: { xs: 2, md: 3 } }}>
          {/* Search Bar */}
          <Box sx={{ mb: 4 }}>
            <TextField
              fullWidth
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Start typing to filter food items by name..."
              autoComplete="off"
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
                    Your Food Items ({filteredUserFoodItems.length})
                  </Typography>
                  {userLoading && <CircularProgress size={20} />}
                </Box>
                
                {filteredUserFoodItems.length > 0 ? (
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
                            {paginatedUserFoodItems.map((item) => (
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
                                  {new Date(item.createdAt).toLocaleDateString()}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>

                    {/* Mobile Card View */}
                    <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                      {paginatedUserFoodItems.map((item) => (
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
                              Created: {new Date(item.createdAt).toLocaleDateString()}
                            </Typography>
                          </Box>
                        </Paper>
                      ))}
                    </Box>
                    
                    {filteredUserFoodItems.length > itemsPerPage && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                        <Pagination
                          count={Math.ceil(filteredUserFoodItems.length / itemsPerPage)}
                          page={userPage}
                          onChange={(_, page) => setUserPage(page)}
                          color="primary"
                        />
                      </Box>
                    )}
                  </>
                ) : (
                  <Alert severity="info">
                    {searchTerm ? 'No user food items match your search criteria' : 'No user food items found'}
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
                      Global Food Items Owned By Others ({filteredGlobalFoodItems.length})
                    </Typography>
                    {globalLoading && <CircularProgress size={20} />}
                  </Box>
                  
                  {filteredGlobalFoodItems.length > 0 ? (
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
                              {paginatedGlobalFoodItems.map((item) => (
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
                                    {new Date(item.createdAt).toLocaleDateString()}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>

                      {/* Mobile Card View */}
                      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                        {paginatedGlobalFoodItems.map((item) => (
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
                                Created: {new Date(item.createdAt).toLocaleDateString()}
                              </Typography>
                            </Box>
                          </Paper>
                        ))}
                      </Box>
                      
                      {filteredGlobalFoodItems.length > itemsPerPage && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                          <Pagination
                            count={Math.ceil(filteredGlobalFoodItems.length / itemsPerPage)}
                            page={globalPage}
                            onChange={(_, page) => setGlobalPage(page)}
                            color="primary"
                          />
                        </Box>
                      )}
                    </>
                  ) : (
                    <Alert severity="info">
                      {searchTerm ? 'No global food items match your search criteria' : 'No global food items found not owned by you'}
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
        open={viewDialogOpen} 
        onClose={handleCloseViewDialog}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          {editMode ? 'Edit Food Item' : 'View Food Item'}
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
                              setConfirmGlobalDialogOpen(true);
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
                      {new Date(selectedItem.createdAt).toLocaleString()}
                    </Typography>
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Last Updated</Typography>
                    <Typography variant="body1">
                      {new Date(selectedItem.updatedAt).toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          )}
          
          <Box sx={{ 
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 1, sm: 0 },
            mt: 3,
            pt: 2,
            justifyContent: { xs: 'stretch', sm: 'flex-end' }
          }}>
            {editMode ? (
              <>
                <Button 
                  onClick={() => setEditMode(false)}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Cancel
                </Button>
                <Tooltip 
                  title={canDeleteItem(selectedItem!) ? "Delete this food item" : "Only admins can delete global items"}
                  placement="top"
                >
                  <span>
                    <Button
                      onClick={() => setDeleteConfirmOpen(true)}
                      startIcon={<Delete />}
                      color="error"
                      disabled={!canDeleteItem(selectedItem!)}
                      sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >
                      Delete
                    </Button>
                  </span>
                </Tooltip>
                <Button 
                  onClick={handleUpdateItem} 
                  variant="contained"
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Save
                </Button>
              </>
            ) : (
              <>
                <Button 
                  onClick={handleCloseViewDialog}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Close
                </Button>
                <Button 
                  onClick={handleEditItem} 
                  startIcon={<Edit />}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Edit
                </Button>
              </>
            )}
          </Box>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete &quot;{selectedItem?.name}&quot;? This action cannot be undone.
          </Typography>
          
          <Box sx={{ 
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 1, sm: 0 },
            mt: 3,
            pt: 2
          }}>
            <Button 
              onClick={() => setDeleteConfirmOpen(false)}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleDeleteItem} 
              color="error" 
              variant="contained"
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Delete
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for making global */}
      <Dialog open={confirmGlobalDialogOpen} onClose={() => { setConfirmGlobalDialogOpen(false); }}>
        <DialogTitle>Confirm Make Global</DialogTitle>
        <DialogContent>
          <Typography>
            Making this item global will make it available to all users. <b>This action cannot be undone</b>—once global, the item cannot be made personal again. Are you sure you want to proceed?
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1, sm: 2 }, mt: 3 }}>
            <Button onClick={() => { setConfirmGlobalDialogOpen(false); }} sx={{ width: { xs: '100%', sm: 'auto' } }}>Cancel</Button>
            <Button 
              onClick={() => {
                setEditingItem((prev) => ({ ...prev, isGlobal: true }));
                setConfirmGlobalDialogOpen(false);
              }} 
              color="primary" 
              variant="contained"
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Yes, Make Global
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </AuthenticatedLayout>
  );
} 