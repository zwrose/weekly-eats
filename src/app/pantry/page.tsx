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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Autocomplete,
} from "@mui/material";
import { 
  Kitchen, 
  Add, 
  Delete
} from "@mui/icons-material";
import AuthenticatedLayout from "../../components/AuthenticatedLayout";
import { PantryItemWithFoodItem, CreatePantryItemRequest } from "../../types/pantry";
import { fetchPantryItems, createPantryItem, deletePantryItem } from "../../lib/pantry-utils";
import { fetchFoodItems } from "../../lib/food-items-utils";
import AddFoodItemDialog from "../../components/AddFoodItemDialog";

interface FoodItem {
  _id: string;
  name: string;
  singularName: string;
  pluralName: string;
  unit: string;
}

export default function PantryPage() {
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [pantryItems, setPantryItems] = useState<PantryItemWithFoodItem[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PantryItemWithFoodItem | null>(null);
  const [newItem, setNewItem] = useState<CreatePantryItemRequest>({
    foodItemId: ''
  });
  const [addFoodItemDialogOpen, setAddFoodItemDialogOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [pendingFoodItemName, setPendingFoodItemName] = useState('');

  const itemsPerPage = 25;

  const loadPantryItems = useCallback(async () => {
    try {
      setLoading(true);
      const items = await fetchPantryItems();
      setPantryItems(items);
    } catch (error) {
      console.error('Error loading pantry items:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFoodItems = async () => {
    try {
      const items = await fetchFoodItems();
      setFoodItems(items);
    } catch (error) {
      console.error('Error loading food items:', error);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      loadPantryItems();
      loadFoodItems();
    }
  }, [status, loadPantryItems]);

  // Filter pantry items based on search term
  const filteredPantryItems = pantryItems.filter(item =>
    item.foodItem.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.foodItem.singularName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.foodItem.pluralName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination
  const paginatedPantryItems = filteredPantryItems.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  // Reset pagination when search term changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  const handleCreateItem = async () => {
    try {
      await createPantryItem(newItem);
      setCreateDialogOpen(false);
      setNewItem({ foodItemId: '' });
      setInputText('');
      loadPantryItems();
    } catch (error) {
      console.error('Error creating pantry item:', error);
      alert('Failed to create pantry item');
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedItem?._id) return;
    
    try {
      await deletePantryItem(selectedItem._id);
      setDeleteConfirmOpen(false);
      setSelectedItem(null);
      loadPantryItems();
    } catch (error) {
      console.error('Error deleting pantry item:', error);
      alert('Failed to delete pantry item');
    }
  };

  const openDeleteDialog = (item: PantryItemWithFoodItem) => {
    setSelectedItem(item);
    setDeleteConfirmOpen(true);
  };

  const handleFoodItemSelect = (foodItem: FoodItem | null) => {
    if (foodItem) {
      setNewItem({ foodItemId: foodItem._id });
      setInputText('');
    } else {
      setNewItem({ foodItemId: '' });
    }
  };

  const handleInputChange = (value: string) => {
    setInputText(value);
  };

  const openAddFoodItemDialog = () => {
    setPendingFoodItemName(inputText);
    setAddFoodItemDialogOpen(true);
  };

  const handleAddFoodItem = async (foodItemData: { name: string; singularName: string; pluralName: string; unit: string; isGlobal: boolean }) => {
    try {
      const response = await fetch('/api/food-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(foodItemData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add food item');
      }

      const newFoodItem = await response.json();
      
      // Close the dialog
      setAddFoodItemDialogOpen(false);
      
      // Automatically select the newly created food item
      setNewItem({ foodItemId: newFoodItem._id });
      setInputText('');
      
      // Reload food items to include the new one
      loadFoodItems();
      
    } catch (error) {
      console.error('Error adding food item:', error);
      alert('Failed to add food item');
    }
  };

  const filterOptions = (options: FoodItem[], { inputValue }: { inputValue: string }) => {
    if (!inputValue) return options;
    
    const filtered = options.filter(option =>
      option.name.toLowerCase().includes(inputValue.toLowerCase()) ||
      option.singularName.toLowerCase().includes(inputValue.toLowerCase()) ||
      option.pluralName.toLowerCase().includes(inputValue.toLowerCase())
    );
    
    return filtered;
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
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: { xs: 2, md: 4 } }}>
          <Kitchen sx={{ fontSize: 40, color: "#9c27b0" }} />
          <Typography variant="h3" component="h1" sx={{ color: "#9c27b0" }}>
            Pantry
          </Typography>
        </Box>

        <Box sx={{ 
          display: "flex", 
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: "space-between", 
          alignItems: { xs: 'flex-start', sm: 'center' }, 
          gap: { xs: 2, sm: 0 },
          mb: { xs: 2, md: 4 } 
        }}>
          <Typography variant="h5" gutterBottom>
            Your Pantry Items ({filteredPantryItems.length})
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<Add />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{ bgcolor: "#9c27b0", "&:hover": { bgcolor: "#7b1fa2" } }}
          >
            Add Pantry Item
          </Button>
        </Box>

        <Paper sx={{ p: 3, mt: { xs: 2, md: 3 } }}>
          {/* Search Bar */}
          <Box sx={{ mb: 4 }}>
            <TextField
              fullWidth
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Start typing to filter pantry items by name..."
              autoComplete="off"
            />
          </Box>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : filteredPantryItems.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: '90%', fontWeight: 'bold' }}>Food Item</TableCell>
                        <TableCell sx={{ width: '10%', fontWeight: 'bold' }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedPantryItems.map((item) => (
                        <TableRow key={item._id}>
                          <TableCell>
                            <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                              {item.foodItem.name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <IconButton 
                              size="small" 
                              onClick={() => openDeleteDialog(item)}
                              color="error"
                            >
                              <Delete />
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
                {paginatedPantryItems.map((item) => (
                  <Paper
                    key={item._id}
                    sx={{
                      p: 3,
                      mb: 2,
                      boxShadow: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                        {item.foodItem.name}
                      </Typography>
                      <IconButton 
                        size="small" 
                        onClick={() => openDeleteDialog(item)}
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </Box>
                  </Paper>
                ))}
              </Box>
              
              {filteredPantryItems.length > itemsPerPage && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Pagination
                    count={Math.ceil(filteredPantryItems.length / itemsPerPage)}
                    page={page}
                    onChange={(_, page) => setPage(page)}
                    color="primary"
                  />
                </Box>
              )}
            </>
          ) : (
            <Alert severity="info">
              {searchTerm ? 'No pantry items match your search criteria' : 'No pantry items found. Start by adding items to your pantry!'}
            </Alert>
          )}
        </Paper>

        {/* Create Pantry Item Dialog */}
        <Dialog 
          open={createDialogOpen} 
          onClose={() => setCreateDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Add Pantry Item</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Autocomplete
                options={foodItems}
                getOptionLabel={(option) => option.name}
                value={foodItems.find(item => item._id === newItem.foodItemId) || null}
                onChange={(_, value) => handleFoodItemSelect(value)}
                onInputChange={(_, value) => handleInputChange(value)}
                filterOptions={filterOptions}
                onKeyUp={(e) => {
                  if (e.key === 'Enter') {
                    if (inputText) {
                      // Use setTimeout to ensure the filtering has completed
                      setTimeout(() => {
                        const filteredOptions = filterOptions(foodItems, { inputValue: inputText });
                        if (filteredOptions.length === 0) {
                          openAddFoodItemDialog();
                        }
                      }, 0);
                    }
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Food Item"
                    required
                    fullWidth
                    sx={{ mb: 3 }}
                  />
                )}
                noOptionsText={
                  <Box>
                    <Typography variant="body2" color="text.secondary" mb={1}>
                      No food items found
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={openAddFoodItemDialog}
                    >
                      {inputText 
                        ? `Add "${inputText}" as a Food Item` 
                        : 'Add New Food Item'
                      }
                    </Button>
                  </Box>
                }
              />
            </Box>
            
            <Box sx={{ 
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 1, sm: 0 },
              justifyContent: { xs: 'stretch', sm: 'flex-end' }
            }}>
              <Button 
                onClick={() => setCreateDialogOpen(false)}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateItem}
                variant="contained"
                disabled={!newItem.foodItemId}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Add Item
              </Button>
            </Box>
          </DialogContent>
        </Dialog>

        {/* Add Food Item Dialog */}
        <AddFoodItemDialog
          open={addFoodItemDialogOpen}
          onClose={() => setAddFoodItemDialogOpen(false)}
          onAdd={handleAddFoodItem}
          prefillName={pendingFoodItemName}
        />

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
        >
          <DialogTitle>Remove Pantry Item</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to remove &quot;{selectedItem?.foodItem.name}&quot; from your pantry?
            </Typography>
            
            <Box sx={{ 
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 1, sm: 0 },
              mt: 3,
              pt: 2,
              justifyContent: { xs: 'stretch', sm: 'flex-end' }
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
                Remove
              </Button>
            </Box>
          </DialogContent>
        </Dialog>
      </Container>
    </AuthenticatedLayout>
  );
} 