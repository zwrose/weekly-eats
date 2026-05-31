'use client';

import React, { useState, useMemo } from 'react';
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
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';
import { Add, Search } from '@mui/icons-material';
import { DialogTitle } from '@/components/ui/DialogTitle';
import { tokens } from '@/lib/design-tokens';
import { PurchaseHistoryRecord, ShoppingListItem } from '@/types/shopping-list';

interface StoreHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  historyItems: PurchaseHistoryRecord[];
  currentItems: ShoppingListItem[];
  onAddItems: (
    items: Array<{ foodItemId: string; name: string; quantity: number; unit: string }>
  ) => void;
  loading: boolean;
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }
  const months = Math.floor(diffDays / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

export default function StoreHistoryDialog({
  open,
  onClose,
  historyItems,
  currentItems,
  onAddItems,
  loading,
}: StoreHistoryDialogProps) {
  const theme = useTheme();
  const accent = theme.palette.primary.main;

  const [searchQuery, setSearchQuery] = useState('');
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
    setSearchQuery('');
    setSelectedIds(new Set());
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: tokens.surface.raised,
            border: `1px solid ${tokens.border.strong}`,
            borderRadius: `${tokens.radius.xxxl}px`,
            boxShadow: tokens.shadow.modal,
            // Mobile: full-screen sheet
            margin: { xs: 0, sm: 'auto' },
            width: { xs: '100%' },
            height: { xs: '100%', sm: 'auto' },
            maxHeight: { xs: '100%', sm: '90vh' },
          },
        },
      }}
    >
      <DialogTitle onClose={handleClose}>Purchase History</DialogTitle>
      <DialogContent sx={{ px: { xs: 1, sm: 3 }, pb: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress sx={{ color: accent }} />
          </Box>
        ) : historyItems.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              No purchase history yet. Items will appear here after you finish shopping.
            </Typography>
          </Box>
        ) : (
          <>
            {/* Search field with accent focus ring */}
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
                      <Search sx={{ color: tokens.text.secondary }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                mb: 1.5,
                '& .MuiOutlinedInput-root': {
                  bgcolor: tokens.surface.elevated,
                  borderRadius: `${tokens.radius.xl}px`,
                  '& fieldset': { borderColor: tokens.border.strong },
                  '&:hover fieldset': { borderColor: tokens.border.strong },
                  '&.Mui-focused fieldset': {
                    borderColor: accent,
                    boxShadow: `0 0 0 3px ${alpha(accent, 0.14)}`,
                  },
                },
              }}
            />

            {filteredItems.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Typography color="text.secondary">No items match your search.</Typography>
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
                        borderRadius: `${tokens.radius.lg}px`,
                        mb: 0.5,
                        pr: 7,
                        bgcolor: isSelected ? alpha(accent, 0.08) : 'transparent',
                        border: isSelected
                          ? `1px solid ${alpha(accent, 0.22)}`
                          : '1px solid transparent',
                        transition: 'background-color 0.15s, border-color 0.15s',
                      }}
                    >
                      <Checkbox
                        edge="start"
                        checked={isSelected}
                        disabled={isOnList}
                        onChange={() => handleToggleSelect(item.foodItemId)}
                        sx={{
                          mr: 1,
                          color: tokens.border.strong,
                          '&.Mui-checked': { color: accent },
                        }}
                      />
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body1">{item.name}</Typography>
                            {isOnList && (
                              <Chip
                                label="On list"
                                size="small"
                                sx={{
                                  bgcolor: alpha(accent, 0.12),
                                  color: accent,
                                  border: `1px solid ${alpha(accent, 0.25)}`,
                                  fontWeight: 600,
                                  fontSize: 11,
                                }}
                              />
                            )}
                          </Box>
                        }
                        secondary={`${item.quantity} ${item.unit} · ${formatRelativeDate(item.lastPurchasedAt)}`}
                        slotProps={{ secondary: { sx: { color: tokens.text.secondary } } }}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          aria-label={`Add ${item.name}`}
                          onClick={() => handleAddSingle(item)}
                          disabled={isOnList}
                          size="small"
                          sx={{
                            color: accent,
                            border: `1px solid ${tokens.border.subtle}`,
                            borderRadius: `${tokens.radius.md}px`,
                            '&:hover': { bgcolor: alpha(accent, 0.1) },
                            '&.Mui-disabled': {
                              color: tokens.text.muted,
                              borderColor: 'transparent',
                            },
                          }}
                        >
                          <Add />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  );
                })}
              </List>
            )}

            {/* Sticky "Add Selected" bar */}
            {selectedIds.size > 0 && (
              <Box
                sx={{
                  position: 'sticky',
                  bottom: 0,
                  pt: 1,
                  pb: 1,
                  bgcolor: tokens.surface.raised,
                }}
              >
                <Button
                  fullWidth
                  onClick={handleAddSelected}
                  sx={{
                    bgcolor: accent,
                    color: tokens.onAccent.shop,
                    borderRadius: `${tokens.radius.lg}px`,
                    fontWeight: 700,
                    '&:hover': { bgcolor: accent, filter: 'brightness(1.05)' },
                  }}
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
