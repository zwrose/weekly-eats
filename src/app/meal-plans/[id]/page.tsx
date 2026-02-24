'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import {
  Container,
  Box,
  Typography,
  Button,
  IconButton,
  Snackbar,
  Alert,
  Dialog,
  DialogContent,
  Checkbox,
  TextField,
  Skeleton,
} from '@mui/material';
import { ArrowBack, Edit, Delete } from '@mui/icons-material';
import dynamic from 'next/dynamic';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import {
  MealPlanWithTemplate,
  MealPlanItem,
  MealItem,
  MealType,
  DayOfWeek,
} from '@/types/meal-plan';
import { RecipeIngredient } from '@/types/recipe';
import { fetchMealPlan, updateMealPlan, deleteMealPlan } from '@/lib/meal-plan-utils';
import { getUnitForm } from '@/lib/food-items-utils';
import { parseLocalDate, dayOfWeekToIndex } from '@/lib/date-utils';
import { addDays } from 'date-fns';
import { useConfirmDialog } from '@/lib/hooks';
import { responsiveDialogStyle } from '@/lib/theme';
import { CollapsibleSection, DialogActions, DialogTitle } from '@/components/ui';

const MealEditor = dynamic(() => import('@/components/MealEditor'), { ssr: false });

const recipeLinkSx = {
  color: 'primary.main',
  cursor: 'pointer',
  textDecoration: 'underline',
  textDecorationColor: 'transparent',
  transition: 'text-decoration-color 0.2s',
  '&:hover': {
    textDecorationColor: 'currentcolor',
  },
} as const;

// Helper function to get meal type display name
function getMealTypeName(mealType: string): string {
  if (mealType === 'staples') {
    return 'Weekly Staples';
  }
  return mealType.charAt(0).toUpperCase() + mealType.slice(1);
}

// Helper function to get days in order based on template start day
function getDaysInOrder(startDay: string): string[] {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const startIndex = days.indexOf(startDay);
  return [...days.slice(startIndex), ...days.slice(0, startIndex)];
}

// Helper function to get the date for a specific day of week in the meal plan
function getDateForDay(dayOfWeek: string, mealPlan: MealPlanWithTemplate): string {
  const startDate = parseLocalDate(mealPlan.startDate);
  const targetDayIndex = dayOfWeekToIndex(dayOfWeek as DayOfWeek);
  const startDayIndex = dayOfWeekToIndex(mealPlan.template.startDay);

  let daysToAdd = targetDayIndex - startDayIndex;
  if (daysToAdd < 0) daysToAdd += 7;

  const targetDate = addDays(startDate, daysToAdd);

  return targetDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// Validation function for meal plan items
function validateMealPlan(
  items: MealPlanItem[]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  items.forEach((mealPlanItem) => {
    if (mealPlanItem.skipped) return;

    const dayOfWeek = mealPlanItem.dayOfWeek;
    const mealType = mealPlanItem.mealType;

    if (!mealPlanItem.items || !Array.isArray(mealPlanItem.items)) return;

    mealPlanItem.items.forEach((item: MealItem, itemIndex: number) => {
      if (item.type === 'foodItem' || item.type === 'recipe') {
        if (!item.id || item.id.trim() === '') {
          errors.push(
            `${getMealTypeName(mealType)} on ${getMealTypeName(dayOfWeek)}: Meal item ${itemIndex + 1} must have a food item or recipe selected`
          );
        }
      } else if (item.type === 'ingredientGroup') {
        if (
          !item.ingredients ||
          !Array.isArray(item.ingredients) ||
          item.ingredients.length === 0
        ) {
          errors.push(
            `${getMealTypeName(mealType)} on ${getMealTypeName(dayOfWeek)}: Ingredient group ${itemIndex + 1} must have at least one ingredient`
          );
        } else {
          const group = item.ingredients[0];
          if (!group.title || group.title.trim() === '') {
            errors.push(
              `${getMealTypeName(mealType)} on ${getMealTypeName(dayOfWeek)}: Ingredient group ${itemIndex + 1} must have a title`
            );
          }

          if (group.ingredients && Array.isArray(group.ingredients)) {
            group.ingredients.forEach(
              (ingredient: RecipeIngredient, ingredientIndex: number) => {
                if (!ingredient.id || ingredient.id.trim() === '') {
                  errors.push(
                    `${getMealTypeName(mealType)} on ${getMealTypeName(dayOfWeek)}: Ingredient group "${group.title || 'Untitled'}" - ingredient ${ingredientIndex + 1} must have a food item or recipe selected`
                  );
                }
              }
            );
          }
        }
      }
    });
  });

  return { isValid: errors.length === 0, errors };
}

function MealPlanDetailContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const rawId = params.id;
  const mealPlanId = Array.isArray(rawId) ? rawId[0] : rawId ?? '';

  const isEditMode = searchParams.get('edit') === 'true';

  // Meal plan state
  const [mealPlan, setMealPlan] = useState<MealPlanWithTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editMode, setEditMode] = useState(isEditMode);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  // Delete dialog
  const deleteConfirmDialog = useConfirmDialog();

  // Snackbar
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  const showSnackbar = (
    message: string,
    severity: 'success' | 'error' | 'info' | 'warning' = 'info'
  ) => {
    setSnackbar({ open: true, message, severity });
  };

  // Load meal plan
  const loadMealPlan = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const fetched = await fetchMealPlan(mealPlanId);
      setMealPlan(fetched);
    } catch (err) {
      console.error('Error loading meal plan:', err);
      setError('Failed to load meal plan');
    } finally {
      setLoading(false);
    }
  }, [mealPlanId]);

  useEffect(() => {
    if (status === 'authenticated') {
      loadMealPlan();
    }
  }, [status, loadMealPlan]);

  // Sync edit mode with URL
  useEffect(() => {
    setEditMode(isEditMode);
  }, [isEditMode]);

  // Update validation when meal plan changes
  useEffect(() => {
    if (mealPlan) {
      const validation = validateMealPlan(mealPlan.items);
      setValidationErrors(validation.errors);
    }
  }, [mealPlan]);

  // Edit handlers
  const handleEnterEditMode = () => {
    router.push(`/meal-plans/${mealPlanId}?edit=true`, { scroll: false });
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setShowValidationErrors(false);
    // Reload to discard unsaved changes
    loadMealPlan();
    router.push(`/meal-plans/${mealPlanId}`, { scroll: false });
  };

  const handleSave = async () => {
    if (validationErrors.length > 0) {
      setShowValidationErrors(true);
      return;
    }
    if (!mealPlan?._id) return;

    try {
      // Sanitize: recipes never have units
      const sanitizedItems: MealPlanItem[] = mealPlan.items.map((mpi) => ({
        ...mpi,
        items: mpi.items.map((mealItem) => {
          if (mealItem.type === 'recipe') {
            return { ...mealItem, unit: undefined };
          }
          if (mealItem.type === 'ingredientGroup' && mealItem.ingredients) {
            return {
              ...mealItem,
              ingredients: mealItem.ingredients.map((group) => ({
                ...group,
                ingredients: group.ingredients.map((ingredient) =>
                  ingredient.type === 'recipe' ? { ...ingredient, unit: undefined } : ingredient
                ),
              })),
            };
          }
          return mealItem;
        }),
      }));

      await updateMealPlan(mealPlan._id, { items: sanitizedItems });
      const updated = await fetchMealPlan(mealPlan._id);
      setMealPlan(updated);
      setEditMode(false);
      router.push(`/meal-plans/${mealPlanId}`, { scroll: false });
      showSnackbar('Meal plan updated successfully', 'success');
    } catch (err) {
      console.error('Error updating meal plan:', err);
      showSnackbar('Failed to update meal plan', 'error');
    }
  };

  const handleDelete = async () => {
    if (!mealPlan?._id) return;

    try {
      await deleteMealPlan(mealPlan._id);
      deleteConfirmDialog.closeDialog();
      router.push('/meal-plans');
    } catch (err) {
      console.error('Error deleting meal plan:', err);
      showSnackbar('Failed to delete meal plan', 'error');
    }
  };

  const updateMealPlanState = (updatedMealPlan: MealPlanWithTemplate, skipValidation?: boolean) => {
    setMealPlan(updatedMealPlan);
    if (!skipValidation) {
      const validation = validateMealPlan(updatedMealPlan.items);
      setValidationErrors(validation.errors);
      if (validation.isValid) setShowValidationErrors(false);
    }
  };

  // Check if a specific meal slot has content
  const mealHasContent = (dayOfWeek: string, mealType: string): boolean => {
    if (!mealPlan) return false;
    const mealPlanItem = mealPlan.items.find(
      (item) => item.dayOfWeek === dayOfWeek && item.mealType === mealType
    );
    return (mealPlanItem?.items?.length ?? 0) > 0 || (mealPlanItem?.skipped ?? false);
  };

  // Render
  if (status === 'loading' || loading) {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="lg">
          <Box sx={{ py: { xs: 1, md: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Skeleton variant="rounded" width={100} height={28} />
              <Box sx={{ flex: 1 }} />
              <Skeleton variant="rounded" width={32} height={32} />
            </Box>
            <Skeleton variant="text" width="50%" height={36} sx={{ mb: 2 }} />
            {[0, 1, 2, 3, 4].map((i) => (
              <Box key={i} sx={{ borderBottom: '1px solid', borderBottomColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, py: 1, gap: 0.75 }}>
                  <Skeleton variant="circular" width={18} height={18} />
                  <Skeleton variant="text" width={i === 0 ? 120 : `${[35, 40, 30, 45][i - 1]}%`} height={24} />
                </Box>
              </Box>
            ))}
          </Box>
        </Container>
      </AuthenticatedLayout>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  if (error || !mealPlan) {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="lg">
          <Box sx={{ py: 2 }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => router.push('/meal-plans')}
              sx={{ mb: 2 }}
            >
              Meal Plans
            </Button>
            <Alert severity="error">{error || 'Meal plan not found'}</Alert>
          </Box>
        </Container>
      </AuthenticatedLayout>
    );
  }

  const orderedDays = getDaysInOrder(mealPlan.template.startDay);

  return (
    <AuthenticatedLayout>
      <Container maxWidth="lg">
        <Box sx={{ py: { xs: 1, md: 2 } }}>
          {/* Page header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 2,
            }}
          >
            <Button
              startIcon={<ArrowBack />}
              onClick={() => router.push('/meal-plans')}
              size="small"
              sx={{ color: 'text.secondary' }}
            >
              Meal Plans
            </Button>
            <Box sx={{ flex: 1 }} />
            {editMode ? (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Button onClick={handleCancelEdit} size="small">
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  variant={validationErrors.length > 0 ? 'outlined' : 'contained'}
                  size="small"
                  sx={{
                    ...(validationErrors.length > 0 && {
                      color: 'text.secondary',
                      borderColor: 'text.secondary',
                    }),
                  }}
                >
                  Save
                </Button>
              </Box>
            ) : (
              <IconButton
                onClick={handleEnterEditMode}
                color="inherit"
                size="small"
                aria-label="Edit meal plan"
              >
                <Edit />
              </IconButton>
            )}
          </Box>

          {/* Title */}
          <Typography variant="h5" sx={{ mb: 2 }}>
            {mealPlan.name}
          </Typography>

          {editMode ? (
            /* Edit Mode */
            <Box>
              {/* Validation Errors */}
              {showValidationErrors && validationErrors.length > 0 && (
                <Alert
                  severity="warning"
                  sx={{ mb: 2 }}
                  onClose={() => setShowValidationErrors(false)}
                >
                  <Typography variant="subtitle2" gutterBottom>
                    Please fix the following issues before saving:
                  </Typography>
                  <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
                    {validationErrors.map((validationError, index) => (
                      <Typography key={index} component="li" variant="body2" sx={{ mb: 0.5 }}>
                        {validationError}
                      </Typography>
                    ))}
                  </Box>
                </Alert>
              )}

              {/* Weekly Staples - Edit */}
              <CollapsibleSection title="Weekly Staples" defaultExpanded>
                <Box sx={{ p: 2 }}>
                  <MealEditor
                    mealItems={
                      mealPlan.items.find((item) => item.mealType === 'staples')?.items ?? []
                    }
                    onChange={(newStaples: MealItem[]) => {
                      const updatedMealPlan = { ...mealPlan };
                      const existingStaplesIndex = updatedMealPlan.items.findIndex(
                        (item) => item.mealType === 'staples'
                      );

                      if (existingStaplesIndex !== -1) {
                        updatedMealPlan.items = [...updatedMealPlan.items];
                        updatedMealPlan.items[existingStaplesIndex] = {
                          ...updatedMealPlan.items[existingStaplesIndex],
                          items: newStaples,
                        };
                      } else {
                        updatedMealPlan.items = [
                          ...updatedMealPlan.items,
                          {
                            _id: `temp-${Date.now()}`,
                            mealPlanId: mealPlan._id,
                            dayOfWeek: 'saturday' as DayOfWeek,
                            mealType: 'staples' as MealType,
                            items: newStaples,
                          },
                        ];
                      }

                      updateMealPlanState(updatedMealPlan);
                    }}
                  />
                </Box>
              </CollapsibleSection>

              {/* Days - Edit */}
              {orderedDays.flatMap((dayOfWeek) => {
                const dayItems = mealPlan.items.filter(
                  (item) => item.dayOfWeek === dayOfWeek && item.mealType !== 'staples'
                );
                const meals = (['breakfast', 'lunch', 'dinner'] as MealType[]).filter(
                  (mealType) => mealPlan.template.meals[mealType]
                );

                return meals.map((mealType) => {
                  const mealPlanItem = dayItems.find((item) => item.mealType === mealType);
                  const hasItems = (mealPlanItem?.items?.length ?? 0) > 0;
                  const isSkipped = !hasItems && (mealPlanItem?.skipped ?? false);
                  const skipReason = !hasItems ? (mealPlanItem?.skipReason ?? '') : '';
                  const hasContent = mealHasContent(dayOfWeek, mealType);

                  return (
                    <CollapsibleSection
                      key={`${dayOfWeek}-${mealType}`}
                      title={`${getDateForDay(dayOfWeek, mealPlan)} · ${getMealTypeName(mealType)}`}
                      defaultExpanded={hasContent}
                      rightContent={
                        isSkipped ? (
                          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            Skipped
                          </Typography>
                        ) : undefined
                      }
                    >
                      <Box sx={{ p: 2 }}>
                        {/* Skip controls when no items */}
                        {!hasItems && (
                          <Box
                            sx={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              gap: 1,
                              mb: 1.5,
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Checkbox
                                size="small"
                                checked={isSkipped}
                                onChange={(e) => {
                                  const updatedMealPlan = { ...mealPlan };
                                  updatedMealPlan.items = [...updatedMealPlan.items];
                                  const existingIndex = updatedMealPlan.items.findIndex(
                                    (item) =>
                                      item.dayOfWeek === dayOfWeek &&
                                      item.mealType === mealType
                                  );

                                  if (existingIndex !== -1) {
                                    updatedMealPlan.items[existingIndex] = {
                                      ...updatedMealPlan.items[existingIndex],
                                      skipped: e.target.checked,
                                      skipReason: e.target.checked
                                        ? updatedMealPlan.items[existingIndex].skipReason || ''
                                        : undefined,
                                    };
                                  } else {
                                    updatedMealPlan.items.push({
                                      _id: `temp-${Date.now()}`,
                                      mealPlanId: mealPlan._id,
                                      dayOfWeek: dayOfWeek as DayOfWeek,
                                      mealType: mealType as MealType,
                                      items: [],
                                      skipped: e.target.checked,
                                      skipReason: e.target.checked ? '' : undefined,
                                    });
                                  }

                                  updateMealPlanState(updatedMealPlan);
                                }}
                              />
                              <Typography variant="body2" color="text.secondary">
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
                                  const updatedMealPlan = { ...mealPlan };
                                  updatedMealPlan.items = [...updatedMealPlan.items];
                                  const existingIndex = updatedMealPlan.items.findIndex(
                                    (item) =>
                                      item.dayOfWeek === dayOfWeek &&
                                      item.mealType === mealType
                                  );

                                  if (existingIndex !== -1) {
                                    updatedMealPlan.items[existingIndex] = {
                                      ...updatedMealPlan.items[existingIndex],
                                      skipped: true,
                                      skipReason: e.target.value,
                                    };
                                  } else {
                                    updatedMealPlan.items.push({
                                      _id: `temp-${Date.now()}`,
                                      mealPlanId: mealPlan._id,
                                      dayOfWeek: dayOfWeek as DayOfWeek,
                                      mealType: mealType as MealType,
                                      items: [],
                                      skipped: true,
                                      skipReason: e.target.value,
                                    });
                                  }

                                  updateMealPlanState(updatedMealPlan, true);
                                }}
                              />
                            )}
                          </Box>
                        )}

                        {/* MealEditor when not skipped */}
                        {!isSkipped && (
                          <MealEditor
                            mealItems={mealPlanItem?.items ?? []}
                            onChange={(newItems: MealItem[]) => {
                              const updatedMealPlan = { ...mealPlan };
                              updatedMealPlan.items = [...updatedMealPlan.items];
                              const existingIndex = updatedMealPlan.items.findIndex(
                                (item) =>
                                  item.dayOfWeek === dayOfWeek && item.mealType === mealType
                              );

                              if (existingIndex !== -1) {
                                updatedMealPlan.items[existingIndex] = {
                                  ...updatedMealPlan.items[existingIndex],
                                  items: newItems,
                                };
                              } else {
                                updatedMealPlan.items.push({
                                  _id: `temp-${Date.now()}`,
                                  mealPlanId: mealPlan._id,
                                  dayOfWeek: dayOfWeek as DayOfWeek,
                                  mealType: mealType as MealType,
                                  items: newItems,
                                });
                              }

                              updateMealPlanState(updatedMealPlan);
                            }}
                          />
                        )}
                      </Box>
                    </CollapsibleSection>
                  );
                });
              })}

              {/* Bottom action buttons */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column-reverse', sm: 'row' },
                  gap: 1,
                  mt: 3,
                  justifyContent: { xs: 'stretch', sm: 'flex-start' },
                  alignItems: { xs: 'stretch', sm: 'center' },
                }}
              >
                <Button
                  onClick={() => deleteConfirmDialog.openDialog()}
                  color="error"
                  variant="outlined"
                  startIcon={<Delete />}
                  size="small"
                  sx={{
                    width: { xs: '100%', sm: 'auto' },
                    mr: { xs: 0, sm: 'auto' },
                    border: { sm: 'none' },
                    '&:hover': {
                      border: { sm: 'none' },
                      backgroundColor: { sm: 'rgba(211, 47, 47, 0.04)' },
                    },
                  }}
                >
                  Delete
                </Button>
                <Button
                  onClick={handleCancelEdit}
                  size="small"
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  variant={validationErrors.length > 0 ? 'outlined' : 'contained'}
                  size="small"
                  sx={{
                    width: { xs: '100%', sm: 'auto' },
                    ...(validationErrors.length > 0 && {
                      color: 'text.secondary',
                      borderColor: 'text.secondary',
                    }),
                  }}
                >
                  Save
                </Button>
              </Box>
            </Box>
          ) : (
            /* View Mode */
            <Box>
              {/* Weekly Staples */}
              {(() => {
                const staplesItems = mealPlan.items.filter(
                  (item) => item.mealType === 'staples'
                );
                if (staplesItems.length > 0 && staplesItems[0].items.length > 0) {
                  return (
                    <CollapsibleSection title="Weekly Staples" defaultExpanded>
                      <Box sx={{ p: 2 }}>
                        {staplesItems[0].items.map((staple, index) => {
                          if (staple.type === 'ingredientGroup') {
                            return (
                              <Box key={index} sx={{ mb: 1 }}>
                                {staple.ingredients &&
                                  staple.ingredients.map((group, groupIndex) => (
                                    <Box key={groupIndex} sx={{ mb: 1 }}>
                                      {group.title && (
                                        <Typography
                                          variant="body2"
                                          sx={{ fontWeight: 'bold', mb: 0.5 }}
                                        >
                                          {group.title}:
                                        </Typography>
                                      )}
                                      <Box sx={{ pl: 2 }}>
                                        {group.ingredients.map((ingredient, ingIndex) => (
                                          <Typography
                                            key={ingIndex}
                                            variant="body2"
                                            sx={{ mb: 0.5 }}
                                          >
                                            &bull; {ingredient.quantity}{' '}
                                            {ingredient.type === 'foodItem' &&
                                            ingredient.unit &&
                                            ingredient.unit !== 'each'
                                              ? getUnitForm(
                                                  ingredient.unit,
                                                  ingredient.quantity
                                                ) + ' '
                                              : ''}
                                            {ingredient.name || 'Unknown'}
                                          </Typography>
                                        ))}
                                      </Box>
                                    </Box>
                                  ))}
                              </Box>
                            );
                          } else if (staple.type === 'recipe') {
                            return (
                              <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                                &bull;{' '}
                                <Box
                                  component="a"
                                  href={`/recipes/${staple.id}`}
                                  sx={recipeLinkSx}
                                >
                                  {staple.name}
                                </Box>
                                {staple.quantity && (
                                  <Box
                                    component="span"
                                    sx={{ color: 'text.secondary' }}
                                  >
                                    {' '}
                                    ({staple.quantity}x)
                                  </Box>
                                )}
                              </Typography>
                            );
                          } else {
                            return (
                              <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                                &bull; {staple.name}
                                {staple.type === 'foodItem' &&
                                  staple.quantity &&
                                  staple.unit && (
                                    <Box
                                      component="span"
                                      sx={{ color: 'text.secondary' }}
                                    >
                                      {' '}
                                      ({staple.quantity}{' '}
                                      {getUnitForm(staple.unit, staple.quantity)})
                                    </Box>
                                  )}
                              </Typography>
                            );
                          }
                        })}
                      </Box>
                    </CollapsibleSection>
                  );
                }
                return null;
              })()}

              {/* Days - View */}
              {orderedDays.flatMap((dayOfWeek) => {
                const dayItems = mealPlan.items.filter(
                  (item) => item.dayOfWeek === dayOfWeek && item.mealType !== 'staples'
                );

                const meals = (['breakfast', 'lunch', 'dinner'] as MealType[])
                  .filter((mealType) => mealPlan.template.meals[mealType])
                  .map((mealType) => {
                    const mealPlanItem = dayItems.find((item) => item.mealType === mealType);
                    return { mealType, planItem: mealPlanItem ?? null };
                  });

                return meals.map((meal) => {
                  const isSkipped = meal.planItem?.skipped ?? false;
                  const skipReason = meal.planItem?.skipReason ?? '';
                  const items = meal.planItem?.items ?? [];
                  const hasContent = mealHasContent(dayOfWeek, meal.mealType);

                  return (
                    <CollapsibleSection
                      key={`${dayOfWeek}-${meal.mealType}`}
                      title={`${getDateForDay(dayOfWeek, mealPlan)} · ${getMealTypeName(meal.mealType)}`}
                      defaultExpanded={hasContent}
                      rightContent={
                        isSkipped ? (
                          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            Skipped
                          </Typography>
                        ) : undefined
                      }
                    >
                      <Box sx={{ p: 2 }}>
                        {isSkipped ? (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ fontStyle: 'italic' }}
                          >
                            Skipped{skipReason ? `: ${skipReason}` : ''}
                          </Typography>
                        ) : items.length > 0 ? (
                          <Box>
                            {items.map((mealItem, mealIndex) => {
                              if (mealItem.type === 'ingredientGroup') {
                                return (
                                  <Box key={mealIndex} sx={{ mb: 1 }}>
                                    {mealItem.ingredients &&
                                      mealItem.ingredients.map((group, groupIndex) => (
                                        <Box key={groupIndex} sx={{ mb: 1 }}>
                                          {group.title && (
                                            <Typography
                                              variant="body2"
                                              sx={{ fontWeight: 'bold', mb: 0.5 }}
                                            >
                                              {group.title}:
                                            </Typography>
                                          )}
                                          <Box sx={{ pl: 2 }}>
                                            {group.ingredients.map((ingredient, ingIndex) => (
                                              <Typography
                                                key={ingIndex}
                                                variant="body2"
                                                sx={{ mb: 0.5 }}
                                              >
                                                &bull; {ingredient.quantity}{' '}
                                                {ingredient.type === 'foodItem' &&
                                                ingredient.unit &&
                                                ingredient.unit !== 'each'
                                                  ? getUnitForm(
                                                      ingredient.unit,
                                                      ingredient.quantity
                                                    ) + ' '
                                                  : ''}
                                                {ingredient.name || 'Unknown'}
                                              </Typography>
                                            ))}
                                          </Box>
                                        </Box>
                                      ))}
                                  </Box>
                                );
                              } else if (mealItem.type === 'recipe') {
                                return (
                                  <Typography
                                    key={mealIndex}
                                    variant="body2"
                                    sx={{ mb: 0.5 }}
                                  >
                                    &bull;{' '}
                                    <Box
                                      component="a"
                                      href={`/recipes/${mealItem.id}`}
                                      sx={recipeLinkSx}
                                    >
                                      {mealItem.name}
                                    </Box>
                                    {mealItem.quantity && (
                                      <Box
                                        component="span"
                                        sx={{ color: 'text.secondary' }}
                                      >
                                        {' '}
                                        ({mealItem.quantity}x)
                                      </Box>
                                    )}
                                  </Typography>
                                );
                              } else {
                                return (
                                  <Typography
                                    key={mealIndex}
                                    variant="body2"
                                    sx={{ mb: 0.5 }}
                                  >
                                    &bull; {mealItem.name}
                                    {mealItem.type === 'foodItem' &&
                                      mealItem.quantity &&
                                      mealItem.unit && (
                                        <Box
                                          component="span"
                                          sx={{ color: 'text.secondary' }}
                                        >
                                          {' '}
                                          ({mealItem.quantity}{' '}
                                          {getUnitForm(mealItem.unit, mealItem.quantity)})
                                        </Box>
                                      )}
                                  </Typography>
                                );
                              }
                            })}
                          </Box>
                        ) : (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ fontStyle: 'italic' }}
                          >
                            No items planned yet
                          </Typography>
                        )}
                      </Box>
                    </CollapsibleSection>
                  );
                });
              })}
            </Box>
          )}
        </Box>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteConfirmDialog.open}
          onClose={deleteConfirmDialog.closeDialog}
          sx={responsiveDialogStyle}
        >
          <DialogTitle onClose={deleteConfirmDialog.closeDialog}>Delete Meal Plan</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete &quot;{mealPlan?.name}&quot;? This action cannot be
              undone.
            </Typography>

            <DialogActions primaryButtonIndex={1}>
              <Button
                onClick={deleteConfirmDialog.closeDialog}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                color="error"
                variant="contained"
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Delete
              </Button>
            </DialogActions>
          </DialogContent>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </AuthenticatedLayout>
  );
}

export default function MealPlanDetailPage() {
  return (
    <Suspense
      fallback={
        <AuthenticatedLayout>
          <Container maxWidth="lg">
            <Box sx={{ py: { xs: 1, md: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Skeleton variant="rounded" width={100} height={28} />
                <Box sx={{ flex: 1 }} />
                <Skeleton variant="rounded" width={32} height={32} />
              </Box>
              <Skeleton variant="text" width="50%" height={36} sx={{ mb: 2 }} />
              {[0, 1, 2, 3, 4].map((i) => (
                <Box key={i} sx={{ borderBottom: '1px solid', borderBottomColor: 'divider' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, py: 1, gap: 0.75 }}>
                    <Skeleton variant="circular" width={18} height={18} />
                    <Skeleton variant="text" width={i === 0 ? 120 : `${[35, 40, 30, 45][i - 1]}%`} height={24} />
                  </Box>
                </Box>
              ))}
            </Box>
          </Container>
        </AuthenticatedLayout>
      }
    >
      <MealPlanDetailContent />
    </Suspense>
  );
}
