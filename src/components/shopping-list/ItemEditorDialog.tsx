"use client";

import { useEffect, useRef, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions as MuiDialogActions,
  DialogContent,
  TextField,
  Typography,
} from "@mui/material";
import { DialogTitle } from "@/components/ui";
import { responsiveDialogStyle } from "@/lib/theme";
import QuantityInput from "@/components/food-item-inputs/QuantityInput";
import UnitSelector from "@/components/food-item-inputs/UnitSelector";
import AddFoodItemDialog from "@/components/AddFoodItemDialog";
import {
  useFoodItemSelector,
  type FoodItem,
  type SearchOption,
} from "@/lib/hooks/use-food-item-selector";
import { useFoodItemCreator } from "@/lib/hooks/use-food-item-creator";

export type ItemEditorMode = "add" | "edit";

const ADD_NEW_ID = "__add_new_food_item__";

export type ItemEditorDraft = {
  foodItemId: string;
  quantity: number;
  unit: string;
};

interface SelectedFoodItem {
  _id: string;
  name: string;
  singularName: string;
  pluralName: string;
  unit: string;
  type: "foodItem";
}

export type ItemEditorDialogProps = {
  open: boolean;
  mode: ItemEditorMode;
  title?: string;
  excludeFoodItemIds?: string[];
  initialDraft?: ItemEditorDraft | null;
  onClose: () => void;
  onSave: (draft: ItemEditorDraft) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  onFoodItemAdded?: (foodItem: FoodItem) => Promise<void>;
};

export default function ItemEditorDialog({
  open,
  mode,
  title,
  excludeFoodItemIds = [],
  initialDraft,
  onClose,
  onSave,
  onDelete,
  onFoodItemAdded,
}: ItemEditorDialogProps) {
  const [selectedFoodItem, setSelectedFoodItem] =
    useState<SelectedFoodItem | null>(null);
  const [foodItemInputValue, setFoodItemInputValue] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("each");
  const hasTouchedUnitRef = useRef(false);

  const [keyboardInsetPx, setKeyboardInsetPx] = useState(0);
  const pendingSaveRef = useRef<null | { quantity: number; unit: string }>(null);

  const selector = useFoodItemSelector({
    allowRecipes: false,
    excludeIds: excludeFoodItemIds,
    autoLoad: false,
  });

  const creator = useFoodItemCreator({
    onFoodItemAdded,
    onItemCreated: (newFoodItem) => {
      setSelectedFoodItem({
        _id: newFoodItem._id,
        name: newFoodItem.name,
        singularName: newFoodItem.singularName,
        pluralName: newFoodItem.pluralName,
        unit: newFoodItem.unit,
        type: "foodItem",
      });
      setFoodItemInputValue(newFoodItem.name);
      if (!hasTouchedUnitRef.current) {
        setUnit(newFoodItem.unit);
      }

      if (pendingSaveRef.current) {
        const pending = pendingSaveRef.current;
        pendingSaveRef.current = null;
        void onSave({
          foodItemId: newFoodItem._id!,
          quantity: pending.quantity,
          unit: pending.unit,
        });
      }
    },
  });

  // Reset form state when dialog opens
  useEffect(() => {
    if (!open) return;

    setSelectedFoodItem(null);
    setFoodItemInputValue("");

    const nextQty = initialDraft?.quantity ?? 1;
    setQuantity(nextQty);

    hasTouchedUnitRef.current = false;
    const nextUnit = initialDraft?.unit ?? "each";
    setUnit(nextUnit);

    // In edit mode, resolve the food item name from the API
    if (initialDraft?.foodItemId) {
      void (async () => {
        try {
          const res = await fetch(
            `/api/food-items/${initialDraft.foodItemId}`,
          );
          if (res.ok) {
            const item = await res.json();
            setSelectedFoodItem({
              _id: item._id,
              name: item.name,
              singularName: item.singularName,
              pluralName: item.pluralName,
              unit: item.unit,
              type: "foodItem",
            });
            setFoodItemInputValue(item.name);
          }
        } catch {
          /* ignore - user can still type */
        }
      })();
    }
  }, [open, initialDraft]);

  // Keyboard inset tracking for mobile
  useEffect(() => {
    if (!open) {
      setKeyboardInsetPx(0);
      return;
    }
    if (typeof window === "undefined") return;
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    const update = () => {
      const inset = Math.max(
        0,
        window.innerHeight - (visualViewport.height + visualViewport.offsetTop)
      );
      setKeyboardInsetPx(inset >= 16 ? inset : 0);
    };

    update();
    visualViewport.addEventListener("resize", update);
    visualViewport.addEventListener("scroll", update);
    window.addEventListener("orientationchange", update);
    return () => {
      visualViewport.removeEventListener("resize", update);
      visualViewport.removeEventListener("scroll", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [open]);

  const handleClose = () => {
    pendingSaveRef.current = null;
    creator.closeDialog();
    onClose();
  };

  const handleRequestCreateFoodItem = (name: string) => {
    creator.openDialog(name);
  };

  const handleCreateFoodItem = async (
    foodItemData: Parameters<typeof creator.handleCreate>[0]
  ) => {
    const newItem = await creator.handleCreate(foodItemData);
    if (!newItem) {
      throw new Error(creator.lastError.current || "Failed to add food item");
    }
  };

  const handleSave = async () => {
    const trimmed = foodItemInputValue.trim();
    if (selectedFoodItem) {
      await onSave({ foodItemId: selectedFoodItem._id, quantity, unit });
      return;
    }

    if (!trimmed) return;

    // freeSolo typed value: prompt creation via the AddFoodItemDialog flow.
    pendingSaveRef.current = { quantity, unit };
    handleRequestCreateFoodItem(trimmed);
  };

  const shouldShowAddNewOption =
    selector.inputValue.trim() && !selector.isLoading;
  const addNewOption: SearchOption[] = shouldShowAddNewOption
    ? [
        {
          _id: ADD_NEW_ID,
          name: `Add "${selector.inputValue.trim()}" as a Food Item`,
          singularName: "",
          pluralName: "",
          unit: "",
          type: "foodItem" as const,
        },
      ]
    : [];
  const optionsWithAddNew = [...selector.options, ...addNewOption];

  const isSaveDisabled = !foodItemInputValue.trim() || quantity <= 0;
  const dialogTitle = title ?? (mode === "add" ? "Add Item" : "Edit Item");

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        sx={{
          ...responsiveDialogStyle,
          "& .MuiDialog-paper": {
            ...(((responsiveDialogStyle as unknown as Record<string, unknown>)[
              "& .MuiDialog-paper"
            ] as Record<string, unknown>) ?? {}),
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        <DialogTitle onClose={handleClose}>
          <Typography variant="h6">{dialogTitle}</Typography>
        </DialogTitle>
        <DialogContent sx={{ flex: 1, minHeight: 0 }}>
          <Box
            sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2 }}
          >
            <Autocomplete
              freeSolo
              autoHighlight
              options={optionsWithAddNew}
              loading={selector.isLoading}
              value={selectedFoodItem ?? (foodItemInputValue || null)}
              inputValue={foodItemInputValue}
              onInputChange={(_, value, reason) => {
                setFoodItemInputValue(value);
                selector.handleInputChange(value, reason);
                if (reason === "input") {
                  setSelectedFoodItem(null);
                }
              }}
              onChange={(_, value) => {
                if (typeof value === "string") {
                  setSelectedFoodItem(null);
                  setFoodItemInputValue(value);
                  return;
                }
                if (value?._id === ADD_NEW_ID) {
                  handleRequestCreateFoodItem(foodItemInputValue.trim());
                  return;
                }
                if (value && value.type === "foodItem") {
                  setSelectedFoodItem({
                    _id: value._id,
                    name: value.name,
                    singularName: value.singularName,
                    pluralName: value.pluralName,
                    unit: value.unit,
                    type: "foodItem",
                  });
                  setFoodItemInputValue(value.name);
                  if (!hasTouchedUnitRef.current) {
                    setUnit(value.unit ?? "each");
                  }
                } else {
                  setSelectedFoodItem(null);
                  setFoodItemInputValue("");
                }
              }}
              getOptionLabel={(option) => {
                if (typeof option === "string") return option;
                return option.type === "foodItem" ? option.name : option.title;
              }}
              isOptionEqualToValue={(option, value) => {
                if (typeof value === "string") return false;
                return option._id === value?._id;
              }}
              renderOption={(props, option) => {
                const { key, ...otherProps } = props;
                const label =
                  option.type === "foodItem" ? option.name : option.title;
                if (option._id === ADD_NEW_ID) {
                  return (
                    <Box
                      component="li"
                      key={key}
                      {...otherProps}
                      sx={{ p: "8px !important" }}
                    >
                      <Button
                        size="small"
                        variant="outlined"
                        fullWidth
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRequestCreateFoodItem(
                            foodItemInputValue.trim()
                          );
                        }}
                        sx={{
                          justifyContent: "flex-start",
                          textTransform: "none",
                        }}
                      >
                        {label}
                      </Button>
                    </Box>
                  );
                }
                return (
                  <Box component="li" key={key} {...otherProps}>
                    {label}
                  </Box>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Item Name"
                  placeholder="Start typing…"
                  autoFocus
                />
              )}
              loadingText={
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    py: 1,
                  }}
                >
                  <CircularProgress size={20} />
                  <Typography variant="body2" color="text.secondary">
                    Searching...
                  </Typography>
                </Box>
              }
            />

            <Box
              sx={{
                display: "flex",
                gap: 2,
                flexDirection: { xs: "column", sm: "row" },
              }}
            >
              <QuantityInput
                value={quantity}
                onChange={setQuantity}
                label="Quantity"
                size="small"
                sx={{ width: { xs: "100%", sm: 140 } }}
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
            {mode === "edit" && (
              <Box sx={{ display: { xs: "block", sm: "none" } }}>
                <Button
                  onClick={() => void onDelete?.()}
                  color="error"
                  variant="outlined"
                  sx={{ width: "100%" }}
                >
                  Delete
                </Button>
              </Box>
            )}
          </Box>
        </DialogContent>

        <MuiDialogActions
          sx={{
            px: { xs: 2, sm: 3 },
            pb: { xs: 2, sm: 3 },
            position: { xs: "sticky", sm: "static" },
            bottom: { xs: keyboardInsetPx, sm: "auto" },
            bgcolor: "background.paper",
            zIndex: 1,
          }}
        >
          <Box
            sx={{
              width: "100%",
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              alignItems: { xs: "stretch", sm: "center" },
              justifyContent: { xs: "stretch", sm: "space-between" },
              gap: { xs: 1, sm: 0 },
            }}
          >
            {/* Desktop: Delete bottom-left; Save bottom-right. */}
            <Box sx={{ display: { xs: "none", sm: "block" } }}>
              {mode === "edit" && (
                <Button
                  onClick={() => void onDelete?.()}
                  color="error"
                  variant="outlined"
                >
                  Delete
                </Button>
              )}
            </Box>

            <Box sx={{ width: { xs: "100%", sm: "auto" } }}>
              <Button
                onClick={() => void handleSave()}
                variant="contained"
                disabled={isSaveDisabled}
                sx={{ width: { xs: "100%", sm: "auto" } }}
              >
                Save
              </Button>
            </Box>
          </Box>
        </MuiDialogActions>
      </Dialog>

      <AddFoodItemDialog
        open={creator.isDialogOpen}
        onClose={() => {
          pendingSaveRef.current = null;
          creator.closeDialog();
        }}
        onAdd={handleCreateFoodItem}
        prefillName={creator.prefillName}
      />
    </>
  );
}
