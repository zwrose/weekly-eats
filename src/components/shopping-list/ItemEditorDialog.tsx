'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  createFilterOptions,
  Dialog,
  DialogActions as MuiDialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material';
import { DialogTitle } from '@/components/ui';
import { responsiveDialogStyle } from '@/lib/theme';
import QuantityInput from '@/components/food-item-inputs/QuantityInput';
import UnitSelector from '@/components/food-item-inputs/UnitSelector';
import AddFoodItemDialog from '@/components/AddFoodItemDialog';

export type ItemEditorMode = 'add' | 'edit';

export type FoodItemOption = {
  _id: string;
  name: string;
  singularName: string;
  pluralName: string;
  unit: string;
};

const ADD_NEW_ID = '__add_new_food_item__';

const defaultFilter = createFilterOptions<FoodItemOption>();

export type ItemEditorDraft = {
  foodItemId: string;
  quantity: number;
  unit: string;
};

export type ItemEditorDialogProps = {
  open: boolean;
  mode: ItemEditorMode;
  title?: string;

  foodItems: FoodItemOption[];
  excludeFoodItemIds?: string[];

  initialDraft?: ItemEditorDraft | null;

  onClose: () => void;
  onSave: (draft: ItemEditorDraft) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;

  onFoodItemCreated?: (foodItem: FoodItemOption) => void;
};

export default function ItemEditorDialog({
  open,
  mode,
  title,
  foodItems,
  excludeFoodItemIds = [],
  initialDraft,
  onClose,
  onSave,
  onDelete,
  onFoodItemCreated,
}: ItemEditorDialogProps) {
  const initialFoodItem = useMemo(() => {
    if (!initialDraft?.foodItemId) return null;
    return foodItems.find((f) => f._id === initialDraft.foodItemId) ?? null;
  }, [foodItems, initialDraft?.foodItemId]);

  const [selectedFoodItem, setSelectedFoodItem] = useState<FoodItemOption | null>(null);
  const [foodItemInputValue, setFoodItemInputValue] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('each');
  const hasTouchedUnitRef = useRef(false);

  const [addFoodItemDialogOpen, setAddFoodItemDialogOpen] = useState(false);
  const [prefillFoodItemName, setPrefillFoodItemName] = useState('');
  const pendingSaveRef = useRef<null | { quantity: number; unit: string }>(null);
  const [keyboardInsetPx, setKeyboardInsetPx] = useState(0);

  const selectableFoodItems = useMemo(() => {
    const exclude = new Set(excludeFoodItemIds);
    // In edit mode, allow the currently-selected item even if it is excluded.
    if (initialDraft?.foodItemId) {
      exclude.delete(initialDraft.foodItemId);
    }
    return foodItems.filter((f) => !exclude.has(f._id));
  }, [excludeFoodItemIds, foodItems, initialDraft?.foodItemId]);

  useEffect(() => {
    if (!open) return;

    setSelectedFoodItem(initialFoodItem);
    setFoodItemInputValue(initialFoodItem?.name ?? '');

    const nextQty = initialDraft?.quantity ?? 1;
    setQuantity(nextQty);

    hasTouchedUnitRef.current = false;
    const nextUnit = initialDraft?.unit ?? initialFoodItem?.unit ?? 'each';
    setUnit(nextUnit);
  }, [open, initialDraft, initialFoodItem]);

  useEffect(() => {
    if (!open) {
      setKeyboardInsetPx(0);
      return;
    }
    if (typeof window === 'undefined') return;
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    const update = () => {
      // Approximate keyboard height / bottom inset.
      const inset = Math.max(
        0,
        window.innerHeight - (visualViewport.height + visualViewport.offsetTop)
      );
      // Avoid tiny values that can cause jitter.
      setKeyboardInsetPx(inset >= 16 ? inset : 0);
    };

    update();
    visualViewport.addEventListener('resize', update);
    visualViewport.addEventListener('scroll', update);
    window.addEventListener('orientationchange', update);
    return () => {
      visualViewport.removeEventListener('resize', update);
      visualViewport.removeEventListener('scroll', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [open]);

  const handleClose = () => {
    pendingSaveRef.current = null;
    setAddFoodItemDialogOpen(false);
    setPrefillFoodItemName('');
    onClose();
  };

  const handleRequestCreateFoodItem = (name: string) => {
    setPrefillFoodItemName(name);
    setAddFoodItemDialogOpen(true);
  };

  const handleCreateFoodItem = async (foodItemData: {
    name: string;
    singularName: string;
    pluralName: string;
    unit: string;
    isGlobal: boolean;
    addToPantry: boolean;
  }) => {
    // Mirrors the existing creation flow behavior, but keeps the orchestration local to this dialog.
    const payload = {
      name: foodItemData.name,
      singularName: foodItemData.singularName,
      pluralName: foodItemData.pluralName,
      unit: foodItemData.unit,
      isGlobal: foodItemData.isGlobal,
    };
    const response = await fetch('/api/food-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to add food item');
    }

    const newFoodItem = (await response.json()) as FoodItemOption;
    onFoodItemCreated?.(newFoodItem);

    // Close create dialog and select the new item
    setAddFoodItemDialogOpen(false);
    setSelectedFoodItem(newFoodItem);
    setFoodItemInputValue(newFoodItem.name);
    setPrefillFoodItemName('');

    if (!hasTouchedUnitRef.current) {
      setUnit(newFoodItem.unit);
    }

    // If this create was initiated by Save, complete the save now.
    if (pendingSaveRef.current) {
      const pending = pendingSaveRef.current;
      pendingSaveRef.current = null;
      await onSave({
        foodItemId: newFoodItem._id,
        quantity: pending.quantity,
        unit: pending.unit,
      });
    }
  };

  const handleSave = async () => {
    const trimmed = foodItemInputValue.trim();
    if (selectedFoodItem) {
      await onSave({ foodItemId: selectedFoodItem._id, quantity, unit });
      return;
    }

    if (!trimmed) return;

    // freeSolo typed value: prompt creation via the existing AddFoodItemDialog flow.
    pendingSaveRef.current = { quantity, unit };
    handleRequestCreateFoodItem(trimmed);
  };

  const isSaveDisabled = !foodItemInputValue.trim() || quantity <= 0;
  const dialogTitle = title ?? (mode === 'add' ? 'Add Item' : 'Edit Item');

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        sx={{
          ...responsiveDialogStyle,
          '& .MuiDialog-paper': {
            ...(((responsiveDialogStyle as unknown as Record<string, unknown>)[
              '& .MuiDialog-paper'
            ] as Record<string, unknown>) ?? {}),
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <DialogTitle onClose={handleClose}>
          <Typography variant="h6">{dialogTitle}</Typography>
        </DialogTitle>
        <DialogContent sx={{ flex: 1, minHeight: 0 }}>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Autocomplete
              freeSolo
              autoHighlight
              options={selectableFoodItems}
              value={selectedFoodItem ?? (foodItemInputValue || null)}
              inputValue={foodItemInputValue}
              filterOptions={(options, params) => {
                const filtered = defaultFilter(options, params);
                // Append "Add new" option when user has typed something
                if (params.inputValue.trim()) {
                  filtered.push({
                    _id: ADD_NEW_ID,
                    name: `Add "${params.inputValue.trim()}" as a Food Item`,
                    singularName: '',
                    pluralName: '',
                    unit: '',
                  });
                }
                return filtered;
              }}
              onInputChange={(_, value, reason) => {
                setFoodItemInputValue(value);
                // If user types, treat as freeSolo unless they select an option.
                if (reason === 'input') {
                  setSelectedFoodItem(null);
                }
              }}
              onChange={(_, value) => {
                if (typeof value === 'string') {
                  setSelectedFoodItem(null);
                  setFoodItemInputValue(value);
                  return;
                }
                // Handle "Add new" option
                if (value?._id === ADD_NEW_ID) {
                  handleRequestCreateFoodItem(foodItemInputValue.trim());
                  return;
                }
                setSelectedFoodItem(value);
                setFoodItemInputValue(value?.name ?? '');
                if (value && !hasTouchedUnitRef.current) {
                  setUnit(value.unit);
                }
              }}
              getOptionLabel={(option) => {
                if (typeof option === 'string') return option;
                return option.name;
              }}
              isOptionEqualToValue={(option, value) => {
                if (typeof value === 'string') return false;
                return option._id === value?._id;
              }}
              renderOption={(props, option) => {
                const { key, ...otherProps } = props;
                if (option._id === ADD_NEW_ID) {
                  return (
                    <Box component="li" key={key} {...otherProps} sx={{ p: '8px !important' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        fullWidth
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRequestCreateFoodItem(foodItemInputValue.trim());
                        }}
                        sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                      >
                        {option.name}
                      </Button>
                    </Box>
                  );
                }
                return (
                  <Box component="li" key={key} {...otherProps}>
                    {option.name}
                  </Box>
                );
              }}
              renderInput={(params) => (
                <TextField {...params} label="Item Name" placeholder="Start typing…" autoFocus />
              )}
            />

            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <QuantityInput
                value={quantity}
                onChange={setQuantity}
                label="Quantity"
                size="small"
                sx={{ width: { xs: '100%', sm: 140 } }}
              />
              <UnitSelector
                value={unit}
                quantity={quantity}
                onChange={(nextUnit) => {
                  hasTouchedUnitRef.current = true;
                  setUnit(nextUnit);
                }}
                label="Unit"
                size="small"
                fullWidth={true}
              />
            </Box>

            {/* Mobile: keep delete near the fields; Save lives in bottom actions. */}
            {mode === 'edit' && (
              <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                <Button
                  onClick={() => void onDelete?.()}
                  color="error"
                  variant="outlined"
                  sx={{ width: '100%' }}
                >
                  Delete
                </Button>
              </Box>
            )}
          </Box>
        </DialogContent>

        <MuiDialogActions
          sx={{
            // Match DialogContent padding so buttons don't hug the edges.
            px: { xs: 2, sm: 3 },
            pb: { xs: 2, sm: 3 },
            // Mobile: keep Save visible above the on-screen keyboard.
            position: { xs: 'sticky', sm: 'static' },
            bottom: { xs: keyboardInsetPx, sm: 'auto' },
            bgcolor: 'background.paper',
            zIndex: 1,
          }}
        >
          <Box
            sx={{
              width: '100%',
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'stretch', sm: 'center' },
              justifyContent: { xs: 'stretch', sm: 'space-between' },
              gap: { xs: 1, sm: 0 },
            }}
          >
            {/* Desktop: Delete bottom-left; Save bottom-right. */}
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              {mode === 'edit' && (
                <Button onClick={() => void onDelete?.()} color="error" variant="outlined">
                  Delete
                </Button>
              )}
            </Box>

            <Box sx={{ width: { xs: '100%', sm: 'auto' } }}>
              <Button
                onClick={() => void handleSave()}
                variant="contained"
                disabled={isSaveDisabled}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Save
              </Button>
            </Box>
          </Box>
        </MuiDialogActions>
      </Dialog>

      <AddFoodItemDialog
        open={addFoodItemDialogOpen}
        onClose={() => {
          pendingSaveRef.current = null;
          setAddFoodItemDialogOpen(false);
          setPrefillFoodItemName('');
        }}
        onAdd={handleCreateFoodItem}
        prefillName={prefillFoodItemName}
      />
    </>
  );
}
