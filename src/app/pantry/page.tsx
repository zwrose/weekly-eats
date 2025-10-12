"use client";

import React, { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
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
  IconButton
} from "@mui/material";
import AuthenticatedLayout from "../../components/AuthenticatedLayout";
import { PantryItemWithFoodItem, CreatePantryItemRequest } from "../../types/pantry";
import { createPantryItem, deletePantryItem, fetchPantryItems } from "../../lib/pantry-utils";
import AddFoodItemDialog from "../../components/AddFoodItemDialog";
import { useFoodItems, useSearchPagination, useDialog, useConfirmDialog } from "@/lib/hooks";
import { responsiveDialogStyle } from '@/lib/theme';
import SearchBar from "@/components/optimized/SearchBar";
import Pagination from "@/components/optimized/Pagination";
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Kitchen from '@mui/icons-material/Kitchen';
import Add from '@mui/icons-material/Add';
import Delete from '@mui/icons-material/Delete';
import { DialogActions, DialogTitle } from '@/components/ui';

export default function PantryPage() {
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [pantryItems, setPantryItems] = useState<PantryItemWithFoodItem[]>([]);
  const [newItem, setNewItem] = useState<CreatePantryItemRequest>({ foodItemId: "" });
  const [inputText, setInputText] = useState("");
  const [pendingFoodItemName, setPendingFoodItemName] = useState("");

  // Dialog hooks
  const createDialog = useDialog();
  const deleteConfirmDialog = useConfirmDialog<PantryItemWithFoodItem>();
  const addFoodItemDialog = useDialog();

  // Food items hook
  const { foodItems, loading: foodItemsLoading, addFoodItem } = useFoodItems();

  // Search and pagination
  const pagination = useSearchPagination<PantryItemWithFoodItem>({
    data: pantryItems,
    itemsPerPage: 25,
    searchFunction: (item, term) =>
      item.foodItem.name.toLowerCase().includes(term) ||
      item.foodItem.singularName?.toLowerCase().includes(term) ||
      item.foodItem.pluralName?.toLowerCase().includes(term),
  });

  // Load pantry items
  const loadPantryItems = useCallback(async () => {
    try {
      setLoading(true);
      const items = await fetchPantryItems();
      setPantryItems(items);
    } catch (error) {
      console.error("Error loading pantry items:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  React.useEffect(() => {
    if (status === "authenticated") {
      loadPantryItems();
    }
  }, [status, loadPantryItems]);

  // Handlers
  const handleCreateItem = async () => {
    try {
      await createPantryItem(newItem);
      createDialog.closeDialog();
      setNewItem({ foodItemId: "" });
      setInputText("");
      loadPantryItems();
    } catch (error) {
      console.error("Error creating pantry item:", error);
      alert("Failed to create pantry item");
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteConfirmDialog.data?._id) return;
    try {
      await deletePantryItem(deleteConfirmDialog.data._id);
      deleteConfirmDialog.closeDialog();
      loadPantryItems();
    } catch (error) {
      console.error("Error deleting pantry item:", error);
      alert("Failed to delete pantry item");
    }
  };

  const openAddFoodItemDialog = () => {
    setPendingFoodItemName(inputText);
    addFoodItemDialog.openDialog();
  };

  // UI
  if (status === "loading") {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <Container maxWidth="xl" sx={{ py: { xs: 0.5, md: 1 } }}>
        <Box sx={{ 
          display: "flex", 
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: "space-between", 
          alignItems: { xs: 'flex-start', sm: 'center' }, 
          gap: { xs: 2, sm: 0 },
          mb: { xs: 2, md: 4 } 
        }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Kitchen sx={{ fontSize: 40, color: "#9c27b0" }} />
            <Typography variant="h3" component="h1" sx={{ color: "#9c27b0" }}>
              Pantry Items ({pagination.searchTerm ? `${pagination.totalItems}/${pantryItems.length}` : pantryItems.length})
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={createDialog.openDialog}
            sx={{ bgcolor: "#9c27b0", color: "#fff", '&:hover': { bgcolor: "#7b1fa2" }, minWidth: { xs: "100%", sm: "auto" } }}
          >
            Add Item
          </Button>
        </Box>

        <Paper sx={{ p: 3, mb: 4, maxWidth: 'md', mx: 'auto' }}>
          <SearchBar
            value={pagination.searchTerm}
            onChange={pagination.setSearchTerm}
            placeholder="Search your pantry..."
          />

          {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {pagination.paginatedData.length > 0 ? (
              <>
                {/* Desktop Table View */}
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ width: '70%', fontWeight: 'bold', wordWrap: 'break-word' }}>Food Item</TableCell>
                          <TableCell align="center" sx={{ width: '30%', fontWeight: 'bold', wordWrap: 'break-word' }}>Delete</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {pagination.paginatedData.map((item) => (
                          <TableRow 
                            key={item._id}
                            sx={{ '&:hover': { backgroundColor: 'action.hover' } }}
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
                  {pagination.paginatedData.map((item) => (
                    <Paper
                      key={item._id}
                      sx={{ 
                        p: 3, 
                        mb: 2, 
                        boxShadow: 2, 
                        border: "1px solid", 
                        borderColor: "divider", 
                        borderRadius: 2, 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center",
                        '&:hover': { 
                          backgroundColor: 'action.hover',
                          transform: 'translateY(-2px)',
                          boxShadow: 4
                        },
                        transition: 'all 0.2s ease-in-out'
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

                <Pagination
                  count={pagination.totalPages}
                  page={pagination.currentPage}
                  onChange={pagination.setCurrentPage}
                  show={pagination.totalPages > 1}
                />
              </>
            ) : (
              <Alert severity="info">
                {pagination.searchTerm ? "No pantry items match your search criteria" : "No pantry items found. Add your first item to get started!"}
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
            <Autocomplete
              options={foodItems}
              getOptionLabel={(option) => option.pluralName || option.name}
              loading={foodItemsLoading}
              value={foodItems.find(item => item._id === newItem.foodItemId) || null}
              onChange={(_, value) => {
                setNewItem({ foodItemId: value ? value._id : "" });
                setInputText("");
              }}
              onInputChange={(_, value) => setInputText(value)}
              filterOptions={(options, { inputValue }) => {
                if (!inputValue) return options;
                return options.filter(option =>
                  option.name.toLowerCase().includes(inputValue.toLowerCase()) ||
                  option.singularName.toLowerCase().includes(inputValue.toLowerCase()) ||
                  option.pluralName.toLowerCase().includes(inputValue.toLowerCase())
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Food Item"
                  required
                  fullWidth
                  size="small"
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Enter' &&
                      inputText &&
                      !foodItems.some(item =>
                        item.name.toLowerCase() === inputText.toLowerCase() ||
                        item.singularName.toLowerCase() === inputText.toLowerCase() ||
                        item.pluralName.toLowerCase() === inputText.toLowerCase()
                      )
                    ) {
                      e.preventDefault();
                      openAddFoodItemDialog();
                    }
                  }}
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
                      : 'Add New Food Item'}
                  </Button>
                </Box>
              }
            />
          </DialogContent>
          <DialogActions primaryButtonIndex={1}>
            <Button onClick={createDialog.closeDialog}>
              Cancel
            </Button>
            <Button 
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
            Are you sure you want to remove {deleteConfirmDialog.data?.foodItem.name} from your pantry?
          </DialogContent>
          <DialogActions primaryButtonIndex={1}>
            <Button onClick={deleteConfirmDialog.cancel}>
              Cancel
            </Button>
            <Button 
              onClick={handleDeleteItem} 
              color="error" 
              variant="contained"
            >
              Remove
            </Button>
          </DialogActions>
        </Dialog>

        {/* Add Food Item Dialog */}
        <AddFoodItemDialog
          open={addFoodItemDialog.open}
          onClose={addFoodItemDialog.closeDialog}
          onAdd={async (item) => {
            try {
              // Create the food item in the database
              const response = await fetch('/api/food-items', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(item),
              });

              if (!response.ok) {
                throw new Error('Failed to create food item');
              }

              const newFoodItem = await response.json();
              
              // Add to local state
              addFoodItem(newFoodItem);
              
              // Set the new food item as selected
              setNewItem({ foodItemId: newFoodItem._id });
              setInputText("");
              addFoodItemDialog.closeDialog();
            } catch (error) {
              console.error('Error creating food item:', error);
              alert('Failed to create food item. Please try again.');
            }
          }}
          prefillName={pendingFoodItemName}
        />
      </Container>
    </AuthenticatedLayout>
  );
} 