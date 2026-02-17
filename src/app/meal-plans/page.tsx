"use client";

import {
  Container,
  Typography,
  Box,
  Button,
  Dialog,
  DialogContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  IconButton,
  Snackbar,
  List,
  ListItem,
  ListItemText,
  TextField,
} from "@mui/material";
import { Add, CalendarMonth, Settings, Delete, Share, Check, Close as CloseIcon, PersonAdd } from "@mui/icons-material";
import { useSession } from "next-auth/react";
import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import AuthenticatedLayout from "../../components/AuthenticatedLayout";
import { 
  MealPlanWithTemplate, 
  MealPlanTemplate, 
  CreateMealPlanRequest,
  DayOfWeek,
  MealType,
  MealPlanItem,
  MealItem
} from "../../types/meal-plan";
import { RecipeIngredient } from "../../types/recipe";

import { 
  fetchMealPlans, 
  fetchMealPlan,
  createMealPlan, 
  deleteMealPlan,
  fetchMealPlanTemplate,
  updateMealPlanTemplate,
  updateMealPlan,
  DEFAULT_TEMPLATE
} from "../../lib/meal-plan-utils";
import dynamic from "next/dynamic";
import AddFoodItemDialog from "../../components/AddFoodItemDialog";
import MealEditor from "../../components/MealEditor";
const MealPlanCreateDialog = dynamic(() => import("@/components/MealPlanCreateDialog"), { ssr: false });
const MealPlanViewDialog = dynamic(() => import("@/components/MealPlanViewDialog"), { ssr: false });
import { calculateEndDateAsString, parseLocalDate } from "../../lib/date-utils";
import { addDays } from 'date-fns';
import { checkMealPlanOverlap, findNextAvailableMealPlanStartDate } from "../../lib/meal-plan-utils";
import { 
  inviteUserToMealPlanSharing,
  respondToMealPlanSharingInvitation,
  removeUserFromMealPlanSharing,
  fetchPendingMealPlanSharingInvitations,
  fetchSharedMealPlanUsers,
  fetchMealPlanOwners,
  SharedUser,
  PendingMealPlanInvitation
} from "../../lib/meal-plan-sharing-utils";
import { useDialog, useConfirmDialog, usePersistentDialog } from '@/lib/hooks';
import { responsiveDialogStyle } from '@/lib/theme';
import { DialogActions, DialogTitle } from '@/components/ui';
import { dayOfWeekToIndex, formatDateForAPI } from "../../lib/date-utils";
import MealPlanBrowser from "../../components/MealPlanBrowser";

function MealPlansPageContent() {
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [mealPlans, setMealPlans] = useState<MealPlanWithTemplate[]>([]);
  const [template, setTemplate] = useState<MealPlanTemplate | null>(null);
  const createDialog = useDialog();
  const templateDialog = useDialog();
  const deleteConfirmDialog = useConfirmDialog();
  const viewDialog = usePersistentDialog('viewMealPlan');
  const [selectedMealPlan, setSelectedMealPlan] = useState<MealPlanWithTemplate | null>(null);
  const [editMode, setEditMode] = useState(false);
  
  // State for meal plan editing
  const [addFoodItemDialogOpen, setAddFoodItemDialogOpen] = useState(false);
  const [prefillFoodItemName] = useState('');
  
  // Create meal plan form state
  const [newMealPlan, setNewMealPlan] = useState<CreateMealPlanRequest>({
    startDate: ''
  });

  // Validation state
  const [validationError, setValidationError] = useState<string | null>(null);
  const [mealPlanValidationErrors, setMealPlanValidationErrors] = useState<string[]>([]);
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  // Meal plan sharing state
  const shareDialog = useDialog();
  const leaveSharingConfirmDialog = useConfirmDialog();
  const [pendingMealPlanInvitations, setPendingMealPlanInvitations] = useState<PendingMealPlanInvitation[]>([]);
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]); // Users YOU invited (for sharing dialog)
  const [mealPlanOwners, setMealPlanOwners] = useState<SharedUser[]>([]); // Users who invited YOU (for "Create For" dropdown)
  const [shareEmail, setShareEmail] = useState("");
  const shareEmailRef = useRef<HTMLInputElement>(null);
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null); // For creating meal plans
  const [userSettings, setUserSettings] = useState<{ defaultMealPlanOwner?: string } | null>(null);
  
  // Snackbar state
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });
  
  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setSnackbar({ open: true, message, severity });
  };
  
  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Template form state
  const [templateForm, setTemplateForm] = useState<{
    startDay: DayOfWeek;
    meals: {
      [key in MealType]: boolean;
    };
    weeklyStaples: MealItem[];
  }>({
    startDay: DEFAULT_TEMPLATE.startDay,
    meals: {
      ...DEFAULT_TEMPLATE.meals,
      staples: false // Staples are managed separately
    },
    weeklyStaples: []
  });

  // Organize meal plans by owner
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  const mealPlansByOwner = () => {
    const grouped: Record<string, MealPlanWithTemplate[]> = {};

    mealPlans.forEach(plan => {
      const owner = plan.userId;
      if (!grouped[owner]) {
        grouped[owner] = [];
      }
      grouped[owner].push(plan);
    });

    // Sort owners: current user first, then others alphabetically
    const sortedEntries = Object.entries(grouped).sort(([ownerA], [ownerB]) => {
      if (ownerA === currentUserId) return -1;
      if (ownerB === currentUserId) return 1;
      return getOwnerName(ownerA).localeCompare(getOwnerName(ownerB));
    });

    return Object.fromEntries(sortedEntries);
  };
  
  const getOwnerName = (userId: string): string => {
    if (userId === currentUserId) return 'Your Meal Plans';
    const owner = mealPlanOwners.find(u => u.userId === userId);
    return `Shared by ${owner?.name || owner?.email || 'Unknown User'}`;
  };

  // State to track if we skipped a default due to overlap
  const [skippedDefault, setSkippedDefault] = useState<{ skipped: boolean; skippedFrom?: string; earliestAvailable: string | null } | null>(null);
  




  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch only recent meal plans (last 4 weeks) instead of all
      const now = new Date();
      const fourWeeksAgo = new Date(now);
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      const recentStartDate = formatDateForAPI(fourWeeksAgo);

      const [plans, userTemplate, pendingInvites, invitedUsers, owners, settingsResponse] = await Promise.all([
        fetchMealPlans({ startDate: recentStartDate }),
        fetchMealPlanTemplate(),
        fetchPendingMealPlanSharingInvitations(),
        fetchSharedMealPlanUsers(), // Users YOU invited
        fetchMealPlanOwners(), // Users who invited YOU
        fetch('/api/user/settings').then(res => res.json())
      ]);
      setMealPlans(plans);
      setTemplate(userTemplate);
      setPendingMealPlanInvitations(pendingInvites);
      setSharedUsers(invitedUsers);
      setMealPlanOwners(owners);
      setUserSettings(settingsResponse.settings || null);
      
      // Initialize template form with current template values
      if (userTemplate) {
        setTemplateForm({
          startDay: userTemplate.startDay,
          meals: {
            breakfast: userTemplate.meals.breakfast ?? true,
            lunch: userTemplate.meals.lunch ?? true,
            dinner: userTemplate.meals.dinner ?? true,
            staples: false // Staples are managed separately
          },
          weeklyStaples: userTemplate.weeklyStaples || []
        });
      }
    } catch (error) {
      console.error('Error loading meal plans:', error);
    } finally {
      setLoading(false);
    }
  }, []);



  useEffect(() => {
    if (status === 'authenticated') {
      loadData();
    }
  }, [status, loadData]);

  // Meal plan sharing handlers
  const handleInviteUser = async () => {
    if (!shareEmail.trim()) return;
    
    try {
      await inviteUserToMealPlanSharing(shareEmail.trim());
      setShareEmail("");
      showSnackbar(`Invitation sent to ${shareEmail}`, 'success');
      loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to invite user';
      showSnackbar(message, 'error');
    }
  };

  const handleAcceptMealPlanInvitation = async (userId: string) => {
    try {
      await respondToMealPlanSharingInvitation(userId, 'accept');
      loadData();
      showSnackbar('Invitation accepted', 'success');
    } catch {
      showSnackbar('Failed to accept invitation', 'error');
    }
  };

  const handleRejectMealPlanInvitation = async (userId: string) => {
    try {
      await respondToMealPlanSharingInvitation(userId, 'reject');
      loadData();
    } catch {
      showSnackbar('Failed to reject invitation', 'error');
    }
  };

  const handleRemoveMealPlanUser = async (userId: string) => {
    try {
      await removeUserFromMealPlanSharing(userId);
      loadData();
      showSnackbar('User removed', 'info');
    } catch {
      showSnackbar('Failed to remove user', 'error');
    }
  };

  const handleLeaveSharedMealPlans = async (ownerId: string) => {
    const owner = mealPlanOwners.find(u => u.userId === ownerId);
    const ownerName = owner?.name || owner?.email || 'this user';
    leaveSharingConfirmDialog.openDialog({ ownerId, ownerName });
  };

  const handleConfirmLeaveSharing = async () => {
    const data = leaveSharingConfirmDialog.data as { ownerId: string; ownerName: string } | null;
    if (!data) return;

    try {
      await removeUserFromMealPlanSharing(data.ownerId);
      loadData();
      leaveSharingConfirmDialog.closeDialog();
      showSnackbar(`You've left ${data.ownerName}'s meal plans`, 'info');
    } catch {
      showSnackbar('Failed to leave shared meal plans', 'error');
    }
  };

  // Open create dialog and set default start date
  const handleOpenCreateDialog = () => {
    const startDay = template ? template.startDay : DEFAULT_TEMPLATE.startDay;
    const { startDate, skipped, skippedFrom } = findNextAvailableMealPlanStartDate(startDay, mealPlans);
    setNewMealPlan({ startDate });
    setSkippedDefault(skipped ? { skipped, skippedFrom, earliestAvailable: startDate } : null);
    
    // Use default owner from settings if available and valid
    let defaultOwner = currentUserId || null;
    if (userSettings?.defaultMealPlanOwner) {
      // Verify the default owner is still accessible (either current user or in meal plan owners list)
      const isValidOwner = userSettings.defaultMealPlanOwner === currentUserId || 
                          mealPlanOwners.some(o => o.userId === userSettings.defaultMealPlanOwner);
      if (isValidOwner) {
        defaultOwner = userSettings.defaultMealPlanOwner;
      }
    }
    setSelectedOwner(defaultOwner);
    
    createDialog.openDialog();
  };

  const handleCreateMealPlan = async () => {
    try {
      const targetOwner = selectedOwner || currentUserId;
      await createMealPlan({ ...newMealPlan, ownerId: targetOwner } as CreateMealPlanRequest & { ownerId?: string });
      createDialog.closeDialog();
      setNewMealPlan({ startDate: '' });
      setSelectedOwner(null);
      setValidationError(null);
      loadData();
      showSnackbar('Meal plan created successfully', 'success');
    } catch (error) {
      console.error('Error creating meal plan:', error);
      showSnackbar('Failed to create meal plan', 'error');
    }
  };

  const handleCloseCreateDialog = () => {
    createDialog.closeDialog();
    setNewMealPlan({ startDate: '' });
    setValidationError(null);
    setSkippedDefault(null);
    setSelectedOwner(null);
  };

  const handleUpdateTemplate = async () => {
    try {
      await updateMealPlanTemplate(templateForm);
      templateDialog.closeDialog();
      loadData();
    } catch (error) {
      console.error('Error updating template:', error);
      alert('Failed to update template');
    }
  };

  const handleDeleteMealPlan = async () => {
    if (!selectedMealPlan?._id) return;
    
    try {
      await deleteMealPlan(selectedMealPlan._id);
      deleteConfirmDialog.closeDialog();
      viewDialog.closeDialog();
      setSelectedMealPlan(null);
      setEditMode(false);
      loadData();
    } catch (error) {
      console.error('Error deleting meal plan:', error);
      alert('Failed to delete meal plan');
    }
  };

  // Handle edit meal plan
  const handleEditMealPlan = async (mealPlan: MealPlanWithTemplate) => {
    try {
      // Fetch the full meal plan with populated names
      const fullMealPlan = await fetchMealPlan(mealPlan._id!);
      setSelectedMealPlan(fullMealPlan);
      setEditMode(false);
      viewDialog.openDialog({ mealPlanId: mealPlan._id! });
    } catch (error) {
      console.error('Error loading meal plan details:', error);
      alert('Failed to load meal plan details');
    }
  };

  const handleEditMealPlanMode = () => {
    if (!selectedMealPlan?._id) return;
    setEditMode(true);
    viewDialog.openDialog({ mealPlanId: selectedMealPlan._id, editMode: 'true' });
  };

  // Restore dialog state from URL
  useEffect(() => {
    if (!viewDialog.open) return;
    // Restore selected meal plan if needed
    if (!selectedMealPlan && viewDialog.data?.mealPlanId) {
      const plan = mealPlans.find(p => p._id === viewDialog.data?.mealPlanId);
      if (plan) {
        // Fetch the full meal plan with populated names
        fetchMealPlan(plan._id!).then((fullPlan) => {
          setSelectedMealPlan(fullPlan);
        }).catch((error) => {
          console.error('Error loading meal plan details:', error);
          // Fallback to the plan from the list
          setSelectedMealPlan(plan);
        });
      }
    }
    // Restore edit mode
    if (viewDialog.data?.editMode === 'true' && !editMode) {
      setEditMode(true);
    }
  }, [viewDialog.open, viewDialog.data, selectedMealPlan, mealPlans, editMode]);

    // Validation function to check for incomplete ingredients and ingredient groups
  const validateMealPlan = useCallback((items: MealPlanItem[]): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Check each day's meals
    items.forEach((mealPlanItem) => {
      // Skip validation for meals explicitly marked as skipped
      if (mealPlanItem.skipped) {
        return;
      }
      const dayOfWeek = mealPlanItem.dayOfWeek;
      const mealType = mealPlanItem.mealType;
      
      if (!mealPlanItem.items || !Array.isArray(mealPlanItem.items)) return;
      
      mealPlanItem.items.forEach((item: MealItem, itemIndex: number) => {
        if (item.type === 'foodItem' || item.type === 'recipe') {
          // Check if food item or recipe has an ID selected
          if (!item.id || item.id.trim() === '') {
            errors.push(`${getMealTypeName(mealType)} on ${getMealTypeName(dayOfWeek)}: Meal item ${itemIndex + 1} must have a food item or recipe selected`);
          }
        } else if (item.type === 'ingredientGroup') {
          // Check if ingredient group has a title
          if (!item.ingredients || !Array.isArray(item.ingredients) || item.ingredients.length === 0) {
            errors.push(`${getMealTypeName(mealType)} on ${getMealTypeName(dayOfWeek)}: Ingredient group ${itemIndex + 1} must have at least one ingredient`);
          } else {
            // Check if the group has a title
            const group = item.ingredients[0];
            if (!group.title || group.title.trim() === '') {
              errors.push(`${getMealTypeName(mealType)} on ${getMealTypeName(dayOfWeek)}: Ingredient group ${itemIndex + 1} must have a title`);
            }
            
            // Check if each ingredient in the group has a food item or recipe selected
            if (group.ingredients && Array.isArray(group.ingredients)) {
              group.ingredients.forEach((ingredient: RecipeIngredient, ingredientIndex: number) => {
                if (!ingredient.id || ingredient.id.trim() === '') {
                  errors.push(`${getMealTypeName(mealType)} on ${getMealTypeName(dayOfWeek)}: Ingredient group "${group.title || 'Untitled'}" - ingredient ${ingredientIndex + 1} must have a food item or recipe selected`);
                }
              });
            }
          }
        }
      });
    });
    
    return { isValid: errors.length === 0, errors };
  }, []);

  // Function to update validation errors when meal plan items change
  const updateMealPlanValidation = useCallback(() => {
    if (selectedMealPlan) {
      const validation = validateMealPlan(selectedMealPlan.items);
      setMealPlanValidationErrors(validation.errors);
    }
  }, [selectedMealPlan, validateMealPlan]);

  // Update validation when selected meal plan changes
  useEffect(() => {
    updateMealPlanValidation();
  }, [updateMealPlanValidation]);

  const handleUpdateMealPlan = async () => {
    if (!selectedMealPlan?._id) return;
    
    // Validation is already checked via button disabled state
    try {
      // Sanitize: recipes never have units (some older data may have persisted a default).
      const sanitizedItems: MealPlanItem[] = selectedMealPlan.items.map((mpi) => ({
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
                  ingredient.type === 'recipe'
                    ? { ...ingredient, unit: undefined }
                    : ingredient
                ),
              })),
            };
          }

          return mealItem;
        }),
      }));

      // Update the meal plan with the current items
      await updateMealPlan(selectedMealPlan._id, {
        items: sanitizedItems
      });
      // Fetch the updated meal plan with populated names
      const updatedMealPlan = await fetchMealPlan(selectedMealPlan._id);
      setSelectedMealPlan(updatedMealPlan);
      // Exit edit mode but keep dialog open in view mode
      setEditMode(false);
      viewDialog.openDialog({ mealPlanId: selectedMealPlan._id });
      loadData(); // Refresh the lists
    } catch (error) {
      console.error('Error updating meal plan:', error);
      alert('Failed to update meal plan');
    }
  };







  const handleAddFoodItem = async (foodItemData: { name: string; singularName: string; pluralName: string; unit: string; isGlobal: boolean; addToPantry?: boolean } | { _id: string; name: string; singularName: string; pluralName: string; unit: string; isGlobal: boolean }) => {
    // Check if this is already a created food item (passed from IngredientInput after successful creation)
    // vs. raw form data that needs to be created
    if ('_id' in foodItemData) {
      // This is already a created food item, just close dialog
      setAddFoodItemDialogOpen(false);
      return;
    }

    // This is raw form data that needs to be created (legacy direct dialog usage)
    try {
      // Extract addToPantry before sending to API (API doesn't need it)
      const { addToPantry, ...foodItemPayload } = foodItemData;

      const response = await fetch('/api/food-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(foodItemPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle specific error cases
        if (response.status === 409 && errorData.error === 'Food item already exists') {
          const details = errorData.details || 'A food item with this name already exists. Please choose a different name.';
          alert(details);
          return;
        }
        
        throw new Error(errorData.error || 'Failed to add food item');
      }

      const newFoodItem = await response.json();

      // Add to pantry if requested
      if (addToPantry && newFoodItem._id) {
        try {
          const { createPantryItem } = await import('../../lib/pantry-utils');
          await createPantryItem({ foodItemId: newFoodItem._id });
        } catch (pantryError) {
          // Log error but don't fail the food item creation
          console.error('Error adding food item to pantry:', pantryError);
        }
      }
      
      // Close the dialog
      setAddFoodItemDialogOpen(false);
    } catch (error) {
      console.error('Error adding food item:', error);
      alert('Failed to add food item');
    }
  };

  const handleCloseViewDialog = () => {
    viewDialog.closeDialog();
    setSelectedMealPlan(null);
    setEditMode(false);
  };



  // Helper function to get meal type display name
  const getMealTypeName = (mealType: string): string => {
    if (mealType === 'staples') {
      return 'Weekly Staples';
    }
    return mealType.charAt(0).toUpperCase() + mealType.slice(1);
  };

  // Helper function to get the date for a specific day of week in the meal plan
  const getDateForDay = (dayOfWeek: string): string => {
    const startDate = parseLocalDate(selectedMealPlan?.startDate || '');
    const targetDayIndex = dayOfWeekToIndex(dayOfWeek as DayOfWeek);
    const startDayIndex = dayOfWeekToIndex(selectedMealPlan?.template.startDay || 'saturday');
    
    // Calculate days to add to get to the target day
    let daysToAdd = targetDayIndex - startDayIndex;
    if (daysToAdd < 0) daysToAdd += 7;
    
    const targetDate = addDays(startDate, daysToAdd);
    
    return targetDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Helper function to get days in order of the meal plan
  const getDaysInOrder = (): string[] => {
    if (!selectedMealPlan) return [];
    
    const startDay = selectedMealPlan.template.startDay;
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const startIndex = days.indexOf(startDay);
    
    // Reorder days starting from the meal plan's start day
    return [...days.slice(startIndex), ...days.slice(0, startIndex)];
  };

  // Check for overlapping meal plans
  const checkForOverlaps = useCallback((startDate: string): string | null => {
    if (!startDate) return null;
    
    const overlapResult = checkMealPlanOverlap(startDate, mealPlans);
    if (overlapResult.isOverlapping && overlapResult.conflict) {
      return `This meal plan (${startDate} to ${calculateEndDateAsString(startDate)}) would overlap with "${overlapResult.conflict.planName}" (${overlapResult.conflict.startDate} to ${overlapResult.conflict.endDate})`;
    }
    
    return null;
  }, [mealPlans]);

  // Update validation when start date changes
  useEffect(() => {
    const error = checkForOverlaps(newMealPlan.startDate);
    setValidationError(error);
    
    // Recalculate if this date was skipped due to overlap
    if (newMealPlan.startDate) {
      const startDay = template ? template.startDay : DEFAULT_TEMPLATE.startDay;
      const { startDate, skippedFrom } = findNextAvailableMealPlanStartDate(startDay, mealPlans);
      
      // If the current date is not the earliest available, update the skipped info
      if (startDate !== newMealPlan.startDate) {
        setSkippedDefault({ 
          skipped: true, 
          skippedFrom: skippedFrom || newMealPlan.startDate,
          earliestAvailable: startDate
        });
      } else if (skippedFrom) {
        // If dates match but there was a skipped date, keep the skipped info
        setSkippedDefault({ 
          skipped: true, 
          skippedFrom: skippedFrom,
          earliestAvailable: startDate
        });
      } else {
        setSkippedDefault(null);
      }
    } else {
      setSkippedDefault(null);
    }
  }, [newMealPlan.startDate, checkForOverlaps, template, mealPlans]);

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
      <Container maxWidth="xl">
        <Box sx={{ py: { xs: 0.5, md: 1 } }}>
          <Box sx={{ 
            display: "flex", 
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: "space-between", 
            alignItems: { xs: 'flex-start', sm: 'center' }, 
            gap: { xs: 2, sm: 0 },
            mb: { xs: 2, md: 4 } 
          }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <CalendarMonth sx={{ fontSize: 40, color: "#1976d2" }} />
              <Typography variant="h3" component="h1" sx={{ color: "#1976d2" }}>
                Meal Plans
              </Typography>
            </Box>
            <Box sx={{ 
              display: 'flex', 
              gap: 2,
              alignItems: 'center',
              width: { xs: '100%', sm: 'auto' }
            }}>
              <Button 
                variant="contained" 
                startIcon={<Add />}
                onClick={handleOpenCreateDialog}
                sx={{ 
                  bgcolor: "#1976d2", 
                  "&:hover": { bgcolor: "#1565c0" },
                  flexGrow: 1
                }}
              >
                Create Meal Plan
              </Button>
              <Button 
                variant="outlined"
                onClick={() => templateDialog.openDialog()}
                sx={{ 
                  borderColor: "#1976d2", 
                  color: "#1976d2", 
                  "&:hover": { borderColor: "#1565c0" },
                  minWidth: 'auto',
                  p: 1
                }}
              >
                <Settings />
              </Button>
              <Button 
                variant="outlined"
                onClick={() => shareDialog.openDialog()}
                sx={{ 
                  borderColor: "#1976d2", 
                  color: "#1976d2", 
                  "&:hover": { borderColor: "#1565c0" },
                  minWidth: 'auto',
                  p: 1
                }}
              >
                <Share />
              </Button>
            </Box>
          </Box>

          {/* Pending Meal Plan Sharing Invitations */}
          {pendingMealPlanInvitations.length > 0 && (
            <Paper sx={{ p: 3, mb: 4, maxWidth: 'md', mx: 'auto' }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonAdd />
                Pending Meal Plan Invitations ({pendingMealPlanInvitations.length})
              </Typography>
              <List>
                {pendingMealPlanInvitations.map((inv) => (
                  <Box key={inv.ownerId}>
                    <ListItem>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                        <ListItemText
                          primary={`${inv.ownerName || inv.ownerEmail}'s Meal Plans`}
                          secondary={`Invited ${new Date(inv.invitation.invitedAt).toLocaleDateString()}`}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton
                          color="success"
                          size="small"
                          title="Accept"
                          onClick={() => handleAcceptMealPlanInvitation(inv.invitation.userId)}
                        >
                          <Check fontSize="small" />
                        </IconButton>
                        <IconButton
                          color="error"
                          size="small"
                          title="Reject"
                          onClick={() => handleRejectMealPlanInvitation(inv.invitation.userId)}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </ListItem>
                    <Divider />
                  </Box>
                ))}
              </List>
            </Paper>
          )}

          {/* Recent Meal Plans */}
          <Paper sx={{ p: 3, mb: 4, maxWidth: 'md', mx: 'auto' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Recent Meal Plans</Typography>

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {mealPlans.length > 0 ? (
                  <>
                    {Object.entries(mealPlansByOwner()).map(([ownerId, ownerMealPlans], sectionIndex) => {
                      const owners = Object.keys(mealPlansByOwner());
                      const hasMultipleOwners = owners.length > 1;
                      const isOnlyOwnerAndNotCurrentUser = owners.length === 1 && ownerId !== currentUserId;
                      const shouldShowHeader = hasMultipleOwners || isOnlyOwnerAndNotCurrentUser;

                      return (
                      <Box key={ownerId} sx={{ mb: sectionIndex < Object.keys(mealPlansByOwner()).length - 1 ? 4 : 0 }}>
                        {shouldShowHeader && (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="h6" sx={{ color: 'text.secondary' }}>
                              {getOwnerName(ownerId)}
                            </Typography>
                            {ownerId !== currentUserId && (
                              <Button
                                variant="outlined"
                                size="small"
                                color="error"
                                onClick={() => handleLeaveSharedMealPlans(ownerId)}
                                sx={{ minWidth: { xs: 'auto', sm: '80px' } }}
                              >
                                Leave
                              </Button>
                            )}
                          </Box>
                        )}

                        {/* Desktop Table View */}
                        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                          <TableContainer>
                            <Table>
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 'bold', wordWrap: 'break-word' }}>Meal Plan</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {ownerMealPlans.map((mealPlan) => (
                                  <TableRow
                                    key={mealPlan._id}
                                    onClick={() => handleEditMealPlan(mealPlan)}
                                    sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                                  >
                                    <TableCell sx={{ wordWrap: 'break-word' }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <CalendarMonth sx={{ fontSize: 24, color: 'text.secondary' }} />
                                        <Typography variant="body1">{mealPlan.name}</Typography>
                                      </Box>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Box>

                        {/* Mobile Card View */}
                        <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                          {ownerMealPlans.map((mealPlan) => (
                        <Paper
                          key={mealPlan._id}
                          onClick={() => handleEditMealPlan(mealPlan)}
                          sx={{
                            p: 3,
                            mb: 2,
                            cursor: 'pointer',
                            boxShadow: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                            '&:hover': {
                              backgroundColor: 'action.hover',
                              transform: 'translateY(-2px)',
                              boxShadow: 4
                            },
                            transition: 'all 0.2s ease-in-out'
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CalendarMonth sx={{ fontSize: 24, color: 'text.secondary' }} />
                            <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                              {mealPlan.name}
                            </Typography>
                          </Box>
                        </Paper>
                          ))}
                        </Box>
                      </Box>
                      );
                    }
                    )}
                  </>
                ) : (
                  <Alert severity="info">
                    No recent meal plans. Create your first meal plan to get started!
                  </Alert>
                )}
              </>
            )}
          </Paper>

          {/* Meal Plan History Browser */}
          <Paper sx={{ p: 3, mb: 4, maxWidth: 'md', mx: 'auto' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Meal Plan History</Typography>
            <MealPlanBrowser onPlanSelect={handleEditMealPlan} />
          </Paper>

          {/* Create Meal Plan Dialog */}
          <MealPlanCreateDialog
            open={createDialog.open}
            onClose={handleCloseCreateDialog}
            mealPlanOwners={mealPlanOwners}
            selectedOwner={selectedOwner}
            onSelectedOwnerChange={setSelectedOwner}
            currentUserId={currentUserId}
            newMealPlan={newMealPlan}
            onNewMealPlanChange={setNewMealPlan}
            validationError={validationError}
            skippedDefault={skippedDefault}
            template={template}
            onSubmit={handleCreateMealPlan}
          />

          {/* Template Settings Dialog */}
          <Dialog 
            open={templateDialog.open} 
            onClose={templateDialog.closeDialog}
            maxWidth="lg"
            fullWidth
            sx={responsiveDialogStyle}
          >
            <DialogTitle onClose={templateDialog.closeDialog}>Template Settings</DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2 }}>
                {/* Owner selection if user has shared access */}
                {mealPlanOwners.length > 0 && (
                  <Alert severity="info" sx={{ mb: 3 }}>
                    <Typography variant="body2">
                      Editing your own template. To edit a shared user&apos;s template, create or edit one of their meal plans.
                    </Typography>
                  </Alert>
                )}
                
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>Start Day</InputLabel>
                  <Select
                    value={templateForm.startDay}
                    label="Start Day"
                    onChange={(e) => setTemplateForm({ ...templateForm, startDay: e.target.value as DayOfWeek })}
                  >
                    <MenuItem value="monday">Monday</MenuItem>
                    <MenuItem value="tuesday">Tuesday</MenuItem>
                    <MenuItem value="wednesday">Wednesday</MenuItem>
                    <MenuItem value="thursday">Thursday</MenuItem>
                    <MenuItem value="friday">Friday</MenuItem>
                    <MenuItem value="saturday">Saturday</MenuItem>
                    <MenuItem value="sunday">Sunday</MenuItem>
                  </Select>
                </FormControl>
                
                <Typography variant="subtitle2" gutterBottom>
                  Meals to Include:
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
                  {(['breakfast', 'lunch', 'dinner'] as MealType[]).map((meal) => (
                    <Box key={meal} sx={{ display: 'flex', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        id={meal}
                        checked={templateForm.meals?.[meal] || false}
                        onChange={(e) => setTemplateForm({
                          ...templateForm,
                          meals: { ...templateForm.meals, [meal]: e.target.checked }
                        })}
                      />
                      <label htmlFor={meal} style={{ marginLeft: 8, textTransform: 'capitalize' }}>
                        {meal}
                      </label>
                    </Box>
                  ))}
                </Box>

                <Divider sx={{ my: 3 }} />
                
                <Typography variant="subtitle2" gutterBottom>
                  Weekly Staples (Optional):
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  These items will be automatically added once to new meal plans.
                </Typography>
                
                <MealEditor
                  mealItems={templateForm.weeklyStaples}
                  onChange={(newStaples) => {
                    setTemplateForm({ ...templateForm, weeklyStaples: newStaples });
                  }}
                  onFoodItemAdded={handleAddFoodItem}
                />
              </Box>
              
              <DialogActions primaryButtonIndex={1}>
                <Button 
                  onClick={templateDialog.closeDialog}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdateTemplate}
                  variant="contained"
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Save Settings
                </Button>
              </DialogActions>
            </DialogContent>
          </Dialog>

          {/* View/Edit Meal Plan Dialog */}
          <MealPlanViewDialog
            open={viewDialog.open}
            onClose={handleCloseViewDialog}
            editMode={editMode}
            selectedMealPlan={selectedMealPlan}
            mealPlanValidationErrors={mealPlanValidationErrors}
            showValidationErrors={showValidationErrors}
            onEditMode={handleEditMealPlanMode}
            onCancelEdit={() => {
              setEditMode(false);
              viewDialog.removeDialogData('editMode');
            }}
            onSave={handleUpdateMealPlan}
            onDeleteConfirm={() => deleteConfirmDialog.openDialog()}
            onMealPlanChange={setSelectedMealPlan}
            onValidationUpdate={(errors, hideIfValid) => {
              setMealPlanValidationErrors(errors);
              if (hideIfValid) setShowValidationErrors(false);
            }}
            onShowValidationErrors={setShowValidationErrors}
            onFoodItemAdded={handleAddFoodItem}
            getDaysInOrder={getDaysInOrder}
            getDateForDay={getDateForDay}
            getMealTypeName={getMealTypeName}
            validateMealPlan={validateMealPlan}
          />
          {/* Delete Confirmation Dialog */}
          <Dialog
            open={deleteConfirmDialog.open}
            onClose={deleteConfirmDialog.closeDialog}
            sx={responsiveDialogStyle}
          >
            <DialogTitle onClose={deleteConfirmDialog.closeDialog}>Delete Meal Plan</DialogTitle>
            <DialogContent>
              <Typography>
                Are you sure you want to delete &quot;{selectedMealPlan?.name}&quot;? This action cannot be undone.
              </Typography>
              
              <DialogActions primaryButtonIndex={1}>
                <Button 
                  onClick={deleteConfirmDialog.closeDialog}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleDeleteMealPlan} 
                  color="error" 
                  variant="contained"
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Delete
                </Button>
              </DialogActions>
            </DialogContent>
          </Dialog>

          {/* Leave Sharing Confirmation Dialog */}
          <Dialog
            open={leaveSharingConfirmDialog.open}
            onClose={leaveSharingConfirmDialog.closeDialog}
            sx={responsiveDialogStyle}
          >
            <DialogTitle onClose={leaveSharingConfirmDialog.closeDialog}>Leave Shared Meal Plans</DialogTitle>
            <DialogContent>
              <Typography>
                Are you sure you want to leave {(leaveSharingConfirmDialog.data as { ownerName: string } | null)?.ownerName}&apos;s meal plans? You will no longer be able to view or edit their meal plans.
              </Typography>
              
              <DialogActions primaryButtonIndex={1}>
                <Button 
                  onClick={leaveSharingConfirmDialog.closeDialog}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleConfirmLeaveSharing} 
                  color="error" 
                  variant="contained"
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Leave
                </Button>
              </DialogActions>
            </DialogContent>
          </Dialog>

          {/* Add Food Item Dialog */}
          <AddFoodItemDialog
            open={addFoodItemDialogOpen}
            onClose={() => setAddFoodItemDialogOpen(false)}
            onAdd={handleAddFoodItem}
            prefillName={prefillFoodItemName}
          />

          {/* Share Meal Plans Dialog */}
          <Dialog
            open={shareDialog.open}
            onClose={shareDialog.closeDialog}
            maxWidth="sm"
            fullWidth
            sx={responsiveDialogStyle}
            TransitionProps={{ onEntered: () => shareEmailRef.current?.focus() }}
          >
            <DialogTitle onClose={shareDialog.closeDialog}>
              Share Meal Plans
            </DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Invite users by email. They&apos;ll be able to view and edit all your meal plans.
              </Typography>
              
              {/* Invite Section */}
              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <TextField
                  inputRef={shareEmailRef}
                  label="Email Address"
                  type="email"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && shareEmail.trim()) {
                      handleInviteUser();
                    }
                  }}
                  size="small"
                  fullWidth
                  placeholder="user@example.com"
                />
                <Button
                  variant="contained"
                  onClick={handleInviteUser}
                  disabled={!shareEmail.trim()}
                  sx={{ minWidth: 100 }}
                >
                  Invite
                </Button>
              </Box>

              {/* Shared Users List */}
              {sharedUsers && sharedUsers.length > 0 && (
                <>
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
                    Shared With:
                  </Typography>
                  <List>
                    {sharedUsers.map((user) => (
                      <ListItem key={user.userId}>
                        <ListItemText
                          primary={user.name || user.email}
                          secondary={user.email}
                        />
                        <IconButton
                          size="small"
                          color="error"
                          title="Remove user"
                          onClick={() => handleRemoveMealPlanUser(user.userId)}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              <DialogActions primaryButtonIndex={0}>
                <Button onClick={shareDialog.closeDialog} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                  Done
                </Button>
              </DialogActions>
            </DialogContent>
          </Dialog>

          {/* Snackbar for notifications */}
          <Snackbar
            open={snackbar.open}
            autoHideDuration={6000}
            onClose={handleCloseSnackbar}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
              {snackbar.message}
            </Alert>
          </Snackbar>

        </Box>
      </Container>
    </AuthenticatedLayout>
    </Suspense>
  );
}

export default function MealPlansPage() {
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
      <MealPlansPageContent />
    </Suspense>
  );
}