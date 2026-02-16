"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  IconButton,
  TextField,
  Typography,
  Box,
  Button,
  Chip,
  CircularProgress,
  InputAdornment,
} from "@mui/material";
import { Add, Search } from "@mui/icons-material";
import { DialogTitle } from "@/components/ui/DialogTitle";
import { responsiveDialogStyle } from "@/lib/theme";
import { PurchaseHistoryRecord, ShoppingListItem } from "@/types/shopping-list";

interface StoreHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  historyItems: PurchaseHistoryRecord[];
  currentItems: ShoppingListItem[];
  onAddItems: (items: Array<{ foodItemId: string; name: string; quantity: number; unit: string }>) => void;
  loading: boolean;
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  const months = Math.floor(diffDays / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

export default function StoreHistoryDialog({
  open,
  onClose,
  historyItems,
  currentItems,
  onAddItems,
  loading,
}: StoreHistoryDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const currentFoodItemIds = useMemo(
    () => new Set(currentItems.map((i) => i.foodItemId)),
    [currentItems]
  );

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return historyItems;
    const q = searchQuery.toLowerCase();
    return historyItems.filter((item) => item.name.toLowerCase().includes(q));
  }, [historyItems, searchQuery]);

  const handleToggleSelect = (foodItemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(foodItemId)) {
        next.delete(foodItemId);
      } else {
        next.add(foodItemId);
      }
      return next;
    });
  };

  const handleAddSingle = (item: PurchaseHistoryRecord) => {
    onAddItems([
      {
        foodItemId: item.foodItemId,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
      },
    ]);
  };

  const handleAddSelected = () => {
    const items = historyItems
      .filter((item) => selectedIds.has(item.foodItemId))
      .map((item) => ({
        foodItemId: item.foodItemId,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
      }));
    onAddItems(items);
    setSelectedIds(new Set());
  };

  const handleClose = () => {
    setSearchQuery("");
    setSelectedIds(new Set());
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      sx={responsiveDialogStyle}
    >
      <DialogTitle onClose={handleClose}>
        Purchase History
      </DialogTitle>
      <DialogContent sx={{ px: { xs: 1, sm: 3 }, pb: 2 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : historyItems.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography color="text.secondary">
              No purchase history yet. Items will appear here after you finish shopping.
            </Typography>
          </Box>
        ) : (
          <>
            <TextField
              placeholder="Search history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ mb: 1 }}
            />

            {filteredItems.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 3 }}>
                <Typography color="text.secondary">
                  No items match your search.
                </Typography>
              </Box>
            ) : (
              <List dense disablePadding>
                {filteredItems.map((item) => {
                  const isOnList = currentFoodItemIds.has(item.foodItemId);
                  const isSelected = selectedIds.has(item.foodItemId);

                  return (
                    <ListItem
                      key={item.foodItemId}
                      data-testid={`history-item-${item.foodItemId}`}
                      sx={{
                        opacity: isOnList ? 0.6 : 1,
                        borderRadius: 1,
                        mb: 0.5,
                        pr: 7,
                      }}
                    >
                      <Checkbox
                        edge="start"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(item.foodItemId)}
                        sx={{ mr: 1 }}
                      />
                      <ListItemText
                        primary={
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="body1">{item.name}</Typography>
                            {isOnList && (
                              <Chip label="On list" size="small" color="info" variant="outlined" />
                            )}
                          </Box>
                        }
                        secondary={`${item.quantity} ${item.unit} \u00B7 ${formatRelativeDate(item.lastPurchasedAt)}`}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          aria-label={`Add ${item.name}`}
                          onClick={() => handleAddSingle(item)}
                          size="small"
                        >
                          <Add />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  );
                })}
              </List>
            )}

            {selectedIds.size > 0 && (
              <Box sx={{ position: "sticky", bottom: 0, pt: 1, pb: 1, bgcolor: "background.paper" }}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleAddSelected}
                >
                  Add Selected ({selectedIds.size})
                </Button>
              </Box>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
