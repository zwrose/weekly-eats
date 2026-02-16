"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  IconButton,
  Alert,
  Paper,
  TextField,
  Checkbox,
  Divider,
} from "@mui/material";
import { Edit, Delete } from "@mui/icons-material";
import {
  MealPlanWithTemplate,
  MealType,
  DayOfWeek,
  MealPlanItem,
  MealItem,
} from "@/types/meal-plan";
import { getUnitForm } from "@/lib/food-items-utils";
import { responsiveDialogStyle } from "@/lib/theme";
import { DialogTitle } from "@/components/ui";
import MealEditor from "@/components/MealEditor";

export interface MealPlanViewDialogProps {
  open: boolean;
  onClose: () => void;
  editMode: boolean;
  selectedMealPlan: MealPlanWithTemplate | null;
  mealPlanValidationErrors: string[];
  showValidationErrors: boolean;
  onEditMode: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDeleteConfirm: () => void;
  onMealPlanChange: (mealPlan: MealPlanWithTemplate) => void;
  onValidationUpdate: (errors: string[], hideIfValid: boolean) => void;
  onShowValidationErrors: (show: boolean) => void;
  onFoodItemAdded: (foodItemData: {
    name: string;
    singularName: string;
    pluralName: string;
    unit: string;
  }) => Promise<{ _id: string; name: string; singularName: string; pluralName: string; unit: string }>;
  getDaysInOrder: () => string[];
  getDateForDay: (dayOfWeek: string) => string;
  getMealTypeName: (mealType: string) => string;
  validateMealPlan: (items: MealPlanItem[]) => { isValid: boolean; errors: string[] };
}

const MealPlanViewDialog: React.FC<MealPlanViewDialogProps> = ({
  open,
  onClose,
  editMode,
  selectedMealPlan,
  mealPlanValidationErrors,
  showValidationErrors,
  onEditMode,
  onCancelEdit,
  onSave,
  onDeleteConfirm,
  onMealPlanChange,
  onValidationUpdate,
  onShowValidationErrors,
  onFoodItemAdded,
  getDaysInOrder,
  getDateForDay,
  getMealTypeName,
  validateMealPlan,
}) => {
  const handleSaveClick = () => {
    if (mealPlanValidationErrors.length > 0) {
      onShowValidationErrors(true);
    } else {
      onSave();
    }
  };

  const updateMealPlanItem = (
    updatedMealPlan: MealPlanWithTemplate,
    skipValidation?: boolean
  ) => {
    onMealPlanChange(updatedMealPlan);
    if (!skipValidation) {
      const validation = validateMealPlan(updatedMealPlan.items);
      onValidationUpdate(validation.errors, validation.isValid);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      sx={responsiveDialogStyle}
    >
      <DialogTitle
        onClose={onClose}
        actions={
          editMode ? (
            <Box
              sx={{
                display: { xs: "none", sm: "flex" },
                gap: 1,
                alignItems: "center",
              }}
            >
              <Button onClick={onCancelEdit} size="small" sx={{ minWidth: "auto" }}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveClick}
                variant={
                  mealPlanValidationErrors.length > 0 ? "outlined" : "contained"
                }
                size="small"
                sx={{
                  minWidth: "auto",
                  ...(mealPlanValidationErrors.length > 0 && {
                    color: "text.secondary",
                    borderColor: "text.secondary",
                  }),
                }}
              >
                Save
              </Button>
            </Box>
          ) : (
            <IconButton onClick={onEditMode} color="inherit" aria-label="Edit">
              <Edit />
            </IconButton>
          )
        }
      >
        <Typography variant="h6">
          {selectedMealPlan?.name || "This Meal Plan"}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {selectedMealPlan && (
          <Box sx={{ mt: 2 }}>
            {editMode ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Edit Meal Plan Items
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  Add food items, recipes, or ingredient groups to each meal.
                  Each meal can contain any combination of these types.
                </Typography>

                {/* Validation Errors Display */}
                {showValidationErrors &&
                  mealPlanValidationErrors.length > 0 && (
                    <Alert
                      severity="warning"
                      sx={{ mb: 2 }}
                      onClose={() => onShowValidationErrors(false)}
                    >
                      <Typography variant="subtitle2" gutterBottom>
                        Please fix the following issues before saving:
                      </Typography>
                      <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
                        {mealPlanValidationErrors.map((error, index) => (
                          <Typography
                            key={index}
                            component="li"
                            variant="body2"
                            sx={{ mb: 0.5 }}
                          >
                            {error}
                          </Typography>
                        ))}
                      </Box>
                    </Alert>
                  )}

                {/* Weekly Staples Section - Editable */}
                {(() => {
                  const staplesItems = selectedMealPlan.items.filter(
                    (item) => item.mealType === "staples"
                  );
                  const staples =
                    staplesItems.length > 0 ? staplesItems[0].items : [];

                  return (
                    <Paper
                      elevation={1}
                      sx={{
                        mb: 3,
                        border: "1px solid",
                        borderColor: "primary.main",
                        borderRadius: 2,
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        sx={{
                          p: 2,
                          backgroundColor: "primary.main",
                          color: "primary.contrastText",
                          borderBottom: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Typography
                          variant="h6"
                          sx={{ fontWeight: "bold", textAlign: "center" }}
                        >
                          Weekly Staples
                        </Typography>
                      </Box>

                      <Box sx={{ p: 3 }}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mb: 2 }}
                        >
                          Add, edit, or remove staples for this specific meal
                          plan.
                        </Typography>
                        <MealEditor
                          mealItems={staples}
                          onChange={(newStaples: MealItem[]) => {
                            const updatedMealPlan = { ...selectedMealPlan };
                            const existingStaplesIndex =
                              updatedMealPlan.items.findIndex(
                                (item) => item.mealType === "staples"
                              );

                            if (existingStaplesIndex !== -1) {
                              updatedMealPlan.items[existingStaplesIndex].items =
                                newStaples;
                            } else {
                              updatedMealPlan.items.push({
                                _id: `temp-${Date.now()}`,
                                mealPlanId: selectedMealPlan._id,
                                dayOfWeek: "saturday",
                                mealType: "staples",
                                items: newStaples,
                              });
                            }

                            updateMealPlanItem(updatedMealPlan);
                          }}
                          onFoodItemAdded={onFoodItemAdded}
                        />
                      </Box>
                    </Paper>
                  );
                })()}

                {/* Edit meals by day */}
                {getDaysInOrder().map((dayOfWeek) => {
                  const dayItems = selectedMealPlan.items.filter(
                    (item) =>
                      item.dayOfWeek === dayOfWeek &&
                      item.mealType !== "staples"
                  );
                  const meals = ["breakfast", "lunch", "dinner"] as MealType[];

                  const dayMeals = meals
                    .filter(
                      (mealType) =>
                        selectedMealPlan.template.meals[mealType]
                    )
                    .map((mealType) => {
                      const mealPlanItem = dayItems.find(
                        (item) => item.mealType === mealType
                      );

                      return {
                        mealType,
                        items: mealPlanItem?.items ?? [],
                        planItem: mealPlanItem ?? null,
                      };
                    });

                  return (
                    <Paper
                      key={dayOfWeek}
                      elevation={1}
                      sx={{
                        mb: 3,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 2,
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        sx={{
                          p: 2,
                          backgroundColor: "primary.main",
                          color: "primary.contrastText",
                          borderBottom: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Typography
                          variant="h6"
                          sx={{ fontWeight: "bold", textAlign: "center" }}
                        >
                          {getDateForDay(dayOfWeek)}
                        </Typography>
                      </Box>

                      <Box sx={{ p: 3 }}>
                        {dayMeals.map((meal, mealIndex) => {
                          const hasItems = (meal.items?.length ?? 0) > 0;
                          const isSkipped =
                            !hasItems && (meal.planItem?.skipped ?? false);
                          const skipReason = !hasItems
                            ? (meal.planItem?.skipReason ?? "")
                            : "";

                          return (
                            <Box
                              key={meal.mealType}
                              sx={{
                                mb:
                                  mealIndex === dayMeals.length - 1 ? 0 : 3,
                              }}
                            >
                              <Typography
                                variant="subtitle1"
                                sx={{
                                  mb: 2,
                                  fontWeight: "bold",
                                  color: "text.primary",
                                  borderBottom: "2px solid",
                                  borderColor: "primary.light",
                                  pb: 0.5,
                                  display: "inline-block",
                                }}
                              >
                                {getMealTypeName(meal.mealType)}
                              </Typography>
                              {/* Skip controls only when there are no meal items */}
                              {!hasItems && (
                                <Box
                                  sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "flex-start",
                                    gap: 1,
                                    mb: 1.5,
                                  }}
                                >
                                  <Box
                                    sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 1,
                                    }}
                                  >
                                    <Checkbox
                                      size="small"
                                      checked={isSkipped}
                                      onChange={(e) => {
                                        if (!selectedMealPlan) return;
                                        const updatedMealPlan = {
                                          ...selectedMealPlan,
                                        };
                                        const existingIndex =
                                          updatedMealPlan.items.findIndex(
                                            (item) =>
                                              item.dayOfWeek === dayOfWeek &&
                                              item.mealType === meal.mealType
                                          );

                                        if (existingIndex !== -1) {
                                          updatedMealPlan.items[existingIndex] =
                                            {
                                              ...updatedMealPlan.items[
                                                existingIndex
                                              ],
                                              skipped: e.target.checked,
                                              skipReason: e.target.checked
                                                ? updatedMealPlan.items[
                                                    existingIndex
                                                  ].skipReason || ""
                                                : undefined,
                                            };
                                        } else {
                                          updatedMealPlan.items.push({
                                            _id: `temp-${Date.now()}`,
                                            mealPlanId: selectedMealPlan._id,
                                            dayOfWeek: dayOfWeek as DayOfWeek,
                                            mealType:
                                              meal.mealType as MealType,
                                            items: [],
                                            skipped: e.target.checked,
                                            skipReason: e.target.checked
                                              ? ""
                                              : undefined,
                                          });
                                        }

                                        updateMealPlanItem(updatedMealPlan);
                                      }}
                                    />
                                    <Typography
                                      variant="body2"
                                      color="text.secondary"
                                    >
                                      Skip this meal
                                    </Typography>
                                  </Box>
                                  {isSkipped && (
                                    <TextField
                                      autoFocus
                                      label="Skip reason"
                                      size="small"
                                      fullWidth
                                      value={skipReason}
                                      onChange={(e) => {
                                        if (!selectedMealPlan) return;
                                        const updatedMealPlan = {
                                          ...selectedMealPlan,
                                        };
                                        const existingIndex =
                                          updatedMealPlan.items.findIndex(
                                            (item) =>
                                              item.dayOfWeek === dayOfWeek &&
                                              item.mealType === meal.mealType
                                          );

                                        if (existingIndex !== -1) {
                                          updatedMealPlan.items[existingIndex] =
                                            {
                                              ...updatedMealPlan.items[
                                                existingIndex
                                              ],
                                              skipped: true,
                                              skipReason: e.target.value,
                                            };
                                        } else {
                                          updatedMealPlan.items.push({
                                            _id: `temp-${Date.now()}`,
                                            mealPlanId: selectedMealPlan._id,
                                            dayOfWeek: dayOfWeek as DayOfWeek,
                                            mealType:
                                              meal.mealType as MealType,
                                            items: [],
                                            skipped: true,
                                            skipReason: e.target.value,
                                          });
                                        }

                                        updateMealPlanItem(
                                          updatedMealPlan,
                                          true
                                        );
                                      }}
                                    />
                                  )}
                                </Box>
                              )}

                              {/* Only show MealEditor when meal is not explicitly skipped */}
                              {!isSkipped && (
                                <MealEditor
                                  mealItems={meal.items}
                                  onChange={(newItems: MealItem[]) => {
                                    const updatedMealPlan = {
                                      ...selectedMealPlan,
                                    };
                                    const existingMealPlanItemIndex =
                                      updatedMealPlan.items.findIndex(
                                        (item) =>
                                          item.dayOfWeek === dayOfWeek &&
                                          item.mealType === meal.mealType
                                      );

                                    if (existingMealPlanItemIndex !== -1) {
                                      updatedMealPlan.items[
                                        existingMealPlanItemIndex
                                      ] = {
                                        ...updatedMealPlan.items[
                                          existingMealPlanItemIndex
                                        ],
                                        items: newItems,
                                      };
                                    } else {
                                      updatedMealPlan.items.push({
                                        _id: `temp-${Date.now()}`,
                                        mealPlanId: selectedMealPlan._id,
                                        dayOfWeek: dayOfWeek as DayOfWeek,
                                        mealType: meal.mealType as MealType,
                                        items: newItems,
                                      });
                                    }

                                    updateMealPlanItem(updatedMealPlan);
                                  }}
                                  onFoodItemAdded={onFoodItemAdded}
                                />
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    </Paper>
                  );
                })}
              </Box>
            ) : (
              <Box
                sx={{ display: "flex", flexDirection: "column", gap: 2 }}
              >
                <Divider />

                {/* Weekly Staples Section - View */}
                {(() => {
                  const staplesItems = selectedMealPlan.items.filter(
                    (item) => item.mealType === "staples"
                  );
                  if (staplesItems.length > 0) {
                    return (
                      <Paper
                        elevation={1}
                        sx={{
                          mb: 3,
                          border: "1px solid",
                          borderColor: "primary.main",
                          borderRadius: 2,
                          overflow: "hidden",
                        }}
                      >
                        <Box
                          sx={{
                            p: 2,
                            backgroundColor: "primary.main",
                            color: "primary.contrastText",
                            borderBottom: "1px solid",
                            borderColor: "divider",
                          }}
                        >
                          <Typography
                            variant="h6"
                            sx={{ fontWeight: "bold", textAlign: "center" }}
                          >
                            Weekly Staples
                          </Typography>
                        </Box>

                        <Box sx={{ p: 3 }}>
                          {staplesItems[0].items.map((staple, index) => {
                            if (staple.type === "ingredientGroup") {
                              return (
                                <Box key={index} sx={{ mb: 1 }}>
                                  {staple.ingredients &&
                                    staple.ingredients.map(
                                      (group, groupIndex) => (
                                        <Box
                                          key={groupIndex}
                                          sx={{ mb: 1 }}
                                        >
                                          {group.title && (
                                            <Typography
                                              variant="body2"
                                              sx={{
                                                fontWeight: "bold",
                                                mb: 0.5,
                                              }}
                                            >
                                              {group.title}:
                                            </Typography>
                                          )}
                                          <Box sx={{ pl: 2 }}>
                                            {group.ingredients.map(
                                              (ingredient, ingIndex) => (
                                                <Typography
                                                  key={ingIndex}
                                                  variant="body2"
                                                  sx={{ mb: 0.5 }}
                                                >
                                                  &bull;{" "}
                                                  {ingredient.quantity}{" "}
                                                  {ingredient.type ===
                                                    "foodItem" &&
                                                  ingredient.unit &&
                                                  ingredient.unit !== "each"
                                                    ? getUnitForm(
                                                        ingredient.unit,
                                                        ingredient.quantity
                                                      ) + " "
                                                    : ""}
                                                  {ingredient.name ||
                                                    "Unknown"}
                                                </Typography>
                                              )
                                            )}
                                          </Box>
                                        </Box>
                                      )
                                    )}
                                </Box>
                              );
                            } else {
                              return (
                                <Typography
                                  key={index}
                                  variant="body2"
                                  sx={{ mb: 0.5 }}
                                >
                                  &bull; {staple.name}
                                  {staple.type === "foodItem" &&
                                    staple.quantity &&
                                    staple.unit && (
                                      <span
                                        style={{ color: "text.secondary" }}
                                      >
                                        {" "}
                                        ({staple.quantity}{" "}
                                        {getUnitForm(
                                          staple.unit,
                                          staple.quantity
                                        )}
                                        )
                                      </span>
                                    )}
                                  {staple.type === "recipe" &&
                                    staple.quantity && (
                                      <span
                                        style={{ color: "text.secondary" }}
                                      >
                                        {" "}
                                        ({staple.quantity}x)
                                      </span>
                                    )}
                                </Typography>
                              );
                            }
                          })}
                        </Box>
                      </Paper>
                    );
                  }
                  return null;
                })()}

                {/* Show meals by day */}
                {getDaysInOrder().map((dayOfWeek) => {
                  const dayItems = selectedMealPlan.items.filter(
                    (item) =>
                      item.dayOfWeek === dayOfWeek &&
                      item.mealType !== "staples"
                  );

                  return (
                    <Paper
                      key={dayOfWeek}
                      elevation={1}
                      sx={{
                        mb: 3,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 2,
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        sx={{
                          p: 2,
                          backgroundColor: "primary.main",
                          color: "primary.contrastText",
                          borderBottom: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Typography
                          variant="h6"
                          sx={{ fontWeight: "bold", textAlign: "center" }}
                        >
                          {getDateForDay(dayOfWeek)}
                        </Typography>
                      </Box>

                      <Box sx={{ p: 3 }}>
                        {(
                          ["breakfast", "lunch", "dinner"] as MealType[]
                        )
                          .filter(
                            (mealType) =>
                              selectedMealPlan.template.meals[mealType]
                          )
                          .map((mealType) => {
                            const mealItems = dayItems.filter(
                              (item) => item.mealType === mealType
                            );
                            const mealPlanItem = mealItems[0];
                            const isSkipped =
                              mealPlanItem?.skipped ?? false;
                            const skipReason =
                              mealPlanItem?.skipReason ?? "";

                            return (
                              <Box key={mealType} sx={{ mb: 3 }}>
                                <Typography
                                  variant="subtitle1"
                                  sx={{
                                    mb: 2,
                                    fontWeight: "bold",
                                    color: "text.primary",
                                    borderBottom: "2px solid",
                                    borderColor: "primary.light",
                                    pb: 0.5,
                                    display: "inline-block",
                                  }}
                                >
                                  {getMealTypeName(mealType)}
                                </Typography>
                                {isSkipped ? (
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{
                                      pl: 2,
                                      fontStyle: "italic",
                                    }}
                                  >
                                    Skipped
                                    {skipReason
                                      ? `: ${skipReason}`
                                      : ""}
                                  </Typography>
                                ) : mealItems.length > 0 ? (
                                  <Box sx={{ pl: 2 }}>
                                    {mealItems.map((item, index) => (
                                      <Box key={index}>
                                        {item.items.map(
                                          (mealItem, mealIndex) => {
                                            if (
                                              mealItem.type ===
                                              "ingredientGroup"
                                            ) {
                                              return (
                                                <Box
                                                  key={mealIndex}
                                                  sx={{ mb: 1 }}
                                                >
                                                  {mealItem.ingredients &&
                                                    mealItem.ingredients.map(
                                                      (
                                                        group,
                                                        groupIndex
                                                      ) => (
                                                        <Box
                                                          key={groupIndex}
                                                          sx={{ mb: 1 }}
                                                        >
                                                          {group.title && (
                                                            <Typography
                                                              variant="body2"
                                                              sx={{
                                                                fontWeight:
                                                                  "bold",
                                                                mb: 0.5,
                                                              }}
                                                            >
                                                              {group.title}:
                                                            </Typography>
                                                          )}
                                                          <Box
                                                            sx={{ pl: 2 }}
                                                          >
                                                            {group.ingredients.map(
                                                              (
                                                                ingredient,
                                                                ingIndex
                                                              ) => (
                                                                <Typography
                                                                  key={
                                                                    ingIndex
                                                                  }
                                                                  variant="body2"
                                                                  sx={{
                                                                    mb: 0.5,
                                                                  }}
                                                                >
                                                                  &bull;{" "}
                                                                  {
                                                                    ingredient.quantity
                                                                  }{" "}
                                                                  {ingredient.type ===
                                                                    "foodItem" &&
                                                                  ingredient.unit &&
                                                                  ingredient.unit !==
                                                                    "each"
                                                                    ? getUnitForm(
                                                                        ingredient.unit,
                                                                        ingredient.quantity
                                                                      ) +
                                                                      " "
                                                                    : ""}
                                                                  {ingredient.name ||
                                                                    "Unknown"}
                                                                </Typography>
                                                              )
                                                            )}
                                                          </Box>
                                                        </Box>
                                                      )
                                                    )}
                                                </Box>
                                              );
                                            } else {
                                              return (
                                                <Typography
                                                  key={mealIndex}
                                                  variant="body2"
                                                  sx={{ mb: 0.5 }}
                                                >
                                                  &bull; {mealItem.name}
                                                  {mealItem.type ===
                                                    "foodItem" &&
                                                    mealItem.quantity &&
                                                    mealItem.unit && (
                                                      <span
                                                        style={{
                                                          color:
                                                            "text.secondary",
                                                        }}
                                                      >
                                                        {" "}
                                                        ({mealItem.quantity}{" "}
                                                        {getUnitForm(
                                                          mealItem.unit,
                                                          mealItem.quantity
                                                        )}
                                                        )
                                                      </span>
                                                    )}
                                                  {mealItem.type ===
                                                    "recipe" &&
                                                    mealItem.quantity && (
                                                      <span
                                                        style={{
                                                          color:
                                                            "text.secondary",
                                                        }}
                                                      >
                                                        {" "}
                                                        ({mealItem.quantity}x)
                                                      </span>
                                                    )}
                                                </Typography>
                                              );
                                            }
                                          }
                                        )}
                                        {item.notes && (
                                          <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{
                                              fontStyle: "italic",
                                              ml: 2,
                                            }}
                                          >
                                            Note: {item.notes}
                                          </Typography>
                                        )}
                                      </Box>
                                    ))}
                                  </Box>
                                ) : (
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{
                                      fontStyle: "italic",
                                      pl: 2,
                                    }}
                                  >
                                    No items planned yet
                                  </Typography>
                                )}
                              </Box>
                            );
                          })}
                      </Box>
                    </Paper>
                  );
                })}
              </Box>
            )}
          </Box>
        )}

        {editMode && (
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column-reverse", sm: "row" },
              gap: 1,
              p: 2,
              justifyContent: { xs: "stretch", sm: "flex-start" },
              alignItems: { xs: "stretch", sm: "center" },
            }}
          >
            <Button
              onClick={onDeleteConfirm}
              color="error"
              variant="outlined"
              startIcon={<Delete />}
              sx={{
                width: { xs: "100%", sm: "auto" },
                mr: { xs: 0, sm: "auto" },
                border: { sm: "none" },
                "&:hover": {
                  border: { sm: "none" },
                  backgroundColor: { sm: "rgba(211, 47, 47, 0.04)" },
                },
              }}
            >
              Delete
            </Button>
            <Button
              onClick={onCancelEdit}
              sx={{ width: { xs: "100%", sm: "auto" } }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveClick}
              variant={
                mealPlanValidationErrors.length > 0 ? "outlined" : "contained"
              }
              sx={{
                width: { xs: "100%", sm: "auto" },
                ...(mealPlanValidationErrors.length > 0 && {
                  color: "text.secondary",
                  borderColor: "text.secondary",
                }),
              }}
            >
              Save
            </Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MealPlanViewDialog;
