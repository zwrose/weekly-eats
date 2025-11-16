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
  Checkbox,
} from "@mui/material";
import { Add, CalendarMonth, Settings, Edit, Delete, Share, Check, Close as CloseIcon, PersonAdd } from "@mui/icons-material";
import { useSession } from "next-auth/react";
import { useState, useCallback, useEffect, Suspense } from "react";
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

import { getUnitForm } from "../../lib/food-items-utils";
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
import AddFoodItemDialog from "../../components/AddFoodItemDialog";
import MealEditor from "../../components/MealEditor";
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
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
import { useSearchPagination, useDialog, useConfirmDialog, usePersistentDialog } from '@/lib/hooks';
import { responsiveDialogStyle } from '@/lib/theme';
import SearchBar from '@/components/optimized/SearchBar';
import Pagination from '@/components/optimized/Pagination';
import { DialogActions, DialogTitle } from '@/components/ui';
import { formatDateForAPI } from '@/lib/date-utils';
import { dayOfWeekToIndex } from "../../lib/date-utils";

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

  // Search and pagination
  const mealPlanPagination = useSearchPagination({
    data: mealPlans,
    itemsPerPage: 10,
    searchFields: ['name']
  });

  // Organize meal plans by owner
  const { data: session } = useSession();
  const currentUserId = (session?.user as { id?: string })?.id;
  
  const mealPlansByOwner = () => {
    const grouped: Record<string, MealPlanWithTemplate[]> = {};
    
    mealPlanPagination.paginatedData.forEach(plan => {
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
      const [plans, userTemplate, pendingInvites, invitedUsers, owners, settingsResponse] = await Promise.all([
        fetchMealPlans(),
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
      // Update the meal plan with the current items
      await updateMealPlan(selectedMealPlan._id, {
        items: selectedMealPlan.items
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







  const handleAddFoodItem = async (foodItemData: { name: string; singularName: string; pluralName: string; unit: string; isGlobal: boolean } | { _id: string; name: string; singularName: string; pluralName: string; unit: string; isGlobal: boolean }) => {
    // Check if this is already a created food item (passed from IngredientInput after successful creation)
    // vs. raw form data that needs to be created
    if ('_id' in foodItemData) {
      // This is already a created food item, just close dialog
      setAddFoodItemDialogOpen(false);
      return;
    }

    // This is raw form data that needs to be created (legacy direct dialog usage)
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
        
        // Handle specific error cases
        if (response.status === 409 && errorData.error === 'Food item already exists') {
          const details = errorData.details || 'A food item with this name already exists. Please choose a different name.';
          alert(details);
          return;
        }
        
        throw new Error(errorData.error || 'Failed to add food item');
      }

      await response.json();
      
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

          <Paper sx={{ p: 3, mb: 4, maxWidth: 'md', mx: 'auto' }}>
            <SearchBar
              value={mealPlanPagination.searchTerm}
              onChange={mealPlanPagination.setSearchTerm}
            />

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {mealPlans.length > 0 ? (
                  <>
                    {/* Render sections for each owner */}
                    {Object.entries(mealPlansByOwner()).map(([ownerId, ownerMealPlans], sectionIndex) => {
                      const owners = Object.keys(mealPlansByOwner());
                      const hasMultipleOwners = owners.length > 1;
                      const isOnlyOwnerAndNotCurrentUser = owners.length === 1 && ownerId !== currentUserId;
                      const shouldShowHeader = hasMultipleOwners || isOnlyOwnerAndNotCurrentUser;
                      
                      return (
                      <Box key={ownerId} sx={{ mb: sectionIndex < Object.keys(mealPlansByOwner()).length - 1 ? 4 : 0 }}>
                        {/* Show owner header if multiple owners OR if only owner is not the current user */}
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
                                  <TableCell sx={{ fontWeight: 'bold', wordWrap: 'break-word' }}>Meal Plan (click to open)</TableCell>
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
                    
                    {mealPlans.length > 10 && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                        <Pagination
                          count={mealPlanPagination.totalPages}
                          page={mealPlanPagination.currentPage}
                          onChange={mealPlanPagination.setCurrentPage}
                        />
                      </Box>
                    )}
                  </>
                ) : (
                  <Alert severity="info">
                    {mealPlanPagination.searchTerm ? 'No meal plans match your search criteria' : 'No meal plans found. Create your first meal plan to get started!'}
                  </Alert>
                )}
              </>
            )}
          </Paper>

          {/* Create Meal Plan Dialog */}
          <Dialog 
            open={createDialog.open} 
            onClose={handleCloseCreateDialog}
            maxWidth="sm"
            fullWidth
            sx={responsiveDialogStyle}
          >
            <DialogTitle onClose={handleCloseCreateDialog}>Create Meal Plan</DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2 }}>
                {/* Owner selection if user has shared access */}
                {mealPlanOwners.length > 0 && (
                  <FormControl fullWidth sx={{ mb: 3 }}>
                    <InputLabel>Create For</InputLabel>
                    <Select
                      value={selectedOwner || currentUserId || ''}
                      onChange={(e) => setSelectedOwner(e.target.value)}
                      label="Create For"
                    >
                      <MenuItem value={currentUserId || ''}>Your Meal Plans</MenuItem>
                      {mealPlanOwners.map((user) => (
                        <MenuItem key={user.userId} value={user.userId}>
                          {user.name || user.email}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
                
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Start Date"
                    value={newMealPlan.startDate ? parseLocalDate(newMealPlan.startDate) : null}
                    onChange={(date) => {
                      // Only set the date if it's a valid Date object
                      if (date && date instanceof Date && !isNaN(date.getTime())) {
                        const formattedDate = formatDateForAPI(date);
                        setNewMealPlan({ startDate: formattedDate });
                      } else {
                        // Clear the date if invalid
                        setNewMealPlan({ startDate: '' });
                      }
                    }}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        sx: { mb: 3 },
                        required: true,
                        error: !!validationError,
                        helperText: validationError || '',
                        inputProps: {
                          readOnly: true,
                          inputMode: 'none',
                        },
                      },
                    }}
                  />
                </LocalizationProvider>
                
                {validationError && (
                  <Alert severity="error" sx={{ mb: 3 }}>
                    {validationError}
                  </Alert>
                )}
                
                {skippedDefault?.skipped && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    The earliest available start date that does not overlap with your existing meal plans is <b>{skippedDefault.earliestAvailable}</b>.
                  </Alert>
                )}
                
                {template && (
                  <Box sx={{ 
                    mb: 3, 
                    p: 2, 
                    bgcolor: 'background.paper', 
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1 
                  }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Using your template settings:
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Starts on {template.startDay.charAt(0).toUpperCase() + template.startDay.slice(1)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Includes: {Object.entries(template.meals).filter(([, enabled]) => enabled).map(([meal]) => meal).join(', ')}
                    </Typography>
                  </Box>
                )}
                
                {!template && (
                  <Box sx={{ 
                    mb: 3, 
                    p: 2, 
                    bgcolor: 'background.paper', 
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1 
                  }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Using default template settings:
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Starts on {DEFAULT_TEMPLATE.startDay.charAt(0).toUpperCase() + DEFAULT_TEMPLATE.startDay.slice(1)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Includes: {Object.entries(DEFAULT_TEMPLATE.meals).filter(([, enabled]) => enabled).map(([meal]) => meal).join(', ')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                      You can customize these defaults in Template Settings
                    </Typography>
                  </Box>
                )}
              </Box>
              
              <DialogActions primaryButtonIndex={1}>
                <Button 
                  onClick={handleCloseCreateDialog}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateMealPlan}
                  variant="contained"
                  disabled={!newMealPlan.startDate || !!validationError}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Create Plan
                </Button>
              </DialogActions>
            </DialogContent>
          </Dialog>

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
          <Dialog 
            open={viewDialog.open} 
            onClose={handleCloseViewDialog}
            maxWidth="lg"
            fullWidth
            sx={responsiveDialogStyle}
          >
            <DialogTitle 
              onClose={handleCloseViewDialog}
              actions={
                editMode ? (
                  <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1, alignItems: 'center' }}>
                    <Button 
                      onClick={() => {
                        setEditMode(false);
                        viewDialog.removeDialogData('editMode');
                      }}
                      size="small"
                      sx={{ minWidth: 'auto' }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => {
                        if (mealPlanValidationErrors.length > 0) {
                          setShowValidationErrors(true);
                        } else {
                          handleUpdateMealPlan();
                        }
                      }}
                      variant={mealPlanValidationErrors.length > 0 ? "outlined" : "contained"}
                      size="small"
                      sx={{ 
                        minWidth: 'auto',
                        ...(mealPlanValidationErrors.length > 0 && {
                          color: 'text.secondary',
                          borderColor: 'text.secondary'
                        })
                      }}
                    >
                      Save
                    </Button>
                  </Box>
                ) : (
                  <IconButton onClick={handleEditMealPlanMode} color="inherit" aria-label="Edit">
                    <Edit />
                  </IconButton>
                )
              }
            >
              <Typography variant="h6">
                {selectedMealPlan?.name || 'This Meal Plan'}
              </Typography>
            </DialogTitle>
            <DialogContent>
              {selectedMealPlan && (
                <Box sx={{ mt: 2 }}>
                  {editMode ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Edit Meal Plan Items
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Add food items, recipes, or ingredient groups to each meal. Each meal can contain any combination of these types.
                      </Typography>
                      
                      {/* Validation Errors Display - Only show when user clicks disabled Save button */}
                      {showValidationErrors && mealPlanValidationErrors.length > 0 && (
                        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setShowValidationErrors(false)}>
                          <Typography variant="subtitle2" gutterBottom>
                            Please fix the following issues before saving:
                          </Typography>
                          <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
                            {mealPlanValidationErrors.map((error, index) => (
                              <Typography key={index} component="li" variant="body2" sx={{ mb: 0.5 }}>
                                {error}
                              </Typography>
                            ))}
                          </Box>
                        </Alert>
                      )}
                      
                      {/* Weekly Staples Section - Editable */}
                      {(() => {
                        const staplesItems = selectedMealPlan.items.filter(item => item.mealType === 'staples');
                        const staples = staplesItems.length > 0 ? staplesItems[0].items : [];
                        
                        return (
                          <Paper 
                            elevation={1}
                            sx={{ 
                              mb: 3,
                              border: '1px solid',
                              borderColor: 'primary.main',
                              borderRadius: 2,
                              overflow: 'hidden'
                            }}
                          >
                            {/* Staples Header */}
                            <Box 
                              sx={{ 
                                p: 2, 
                                backgroundColor: 'primary.main',
                                color: 'primary.contrastText',
                                borderBottom: '1px solid',
                                borderColor: 'divider'
                              }}
                            >
                              <Typography variant="h6" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
                                Weekly Staples
                              </Typography>
                            </Box>
                            
                            {/* Staples Content - Editable */}
                            <Box sx={{ p: 3 }}>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Add, edit, or remove staples for this specific meal plan.
                              </Typography>
                              <MealEditor
                                mealItems={staples}
                                onChange={(newStaples) => {
                                  // Update the meal plan staples
                                  const updatedMealPlan = { ...selectedMealPlan };
                                  const existingStaplesIndex = updatedMealPlan.items.findIndex(
                                    item => item.mealType === 'staples'
                                  );
                                  
                                  if (existingStaplesIndex !== -1) {
                                    // Update existing staples
                                    updatedMealPlan.items[existingStaplesIndex].items = newStaples;
                                  } else {
                                    // Create new staples entry
                                    updatedMealPlan.items.push({
                                      _id: `temp-${Date.now()}`,
                                      mealPlanId: selectedMealPlan._id,
                                      dayOfWeek: 'saturday', // Staples don't belong to a specific day
                                      mealType: 'staples',
                                      items: newStaples
                                    });
                                  }
                                  
                                  setSelectedMealPlan(updatedMealPlan);
                                  updateMealPlanValidation();
                                }}
                                onFoodItemAdded={handleAddFoodItem}
                              />
                            </Box>
                          </Paper>
                        );
                      })()}

                      {/* Edit meals by day */}
                      {getDaysInOrder().map((dayOfWeek) => {
                        const dayItems = selectedMealPlan.items.filter(item => item.dayOfWeek === dayOfWeek && item.mealType !== 'staples');
                        const meals = ['breakfast', 'lunch', 'dinner'] as MealType[];
                        
                        // Get all meals for this day that are included in the template
                        const dayMeals = meals
                          .filter(mealType => selectedMealPlan.template.meals[mealType])
                          .map(mealType => {
                            const mealPlanItem = dayItems.find(item => item.mealType === mealType);
                            
                            return {
                              mealType,
                              items: mealPlanItem?.items ?? [],
                              planItem: mealPlanItem ?? null
                            };
                          });
                        
                        return (
                          <Paper 
                            key={dayOfWeek} 
                            elevation={1}
                            sx={{ 
                              mb: 3,
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 2,
                              overflow: 'hidden'
                            }}
                          >
                            {/* Day Header */}
                            <Box 
                              sx={{ 
                                p: 2, 
                                backgroundColor: 'primary.main',
                                color: 'primary.contrastText',
                                borderBottom: '1px solid',
                                borderColor: 'divider'
                              }}
                            >
                              <Typography variant="h6" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
                                {getDateForDay(dayOfWeek)}
                              </Typography>
                            </Box>
                            
                            {/* Day Content */}
                            <Box sx={{ p: 3 }}>
                              {dayMeals.map((meal, mealIndex) => {
                                const hasItems = (meal.items?.length ?? 0) > 0;
                                const isSkipped = !hasItems && (meal.planItem?.skipped ?? false);
                                const skipReason = !hasItems ? (meal.planItem?.skipReason ?? '') : '';

                                return (
                                <Box key={meal.mealType} sx={{ mb: mealIndex === dayMeals.length - 1 ? 0 : 3 }}>
                                  <Typography 
                                    variant="subtitle1" 
                                    sx={{ 
                                      mb: 2, 
                                      fontWeight: 'bold',
                                      color: 'text.primary',
                                      borderBottom: '2px solid',
                                      borderColor: 'primary.light',
                                      pb: 0.5,
                                      display: 'inline-block'
                                    }}
                                  >
                                    {getMealTypeName(meal.mealType)}
                                  </Typography>
                                  {/* Skip controls only when there are no meal items */}
                                  {!hasItems && (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, mb: 1.5 }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Checkbox
                                          size="small"
                                          checked={isSkipped}
                                          onChange={(e) => {
                                            if (!selectedMealPlan) return;
                                            const updatedMealPlan = { ...selectedMealPlan };
                                            const existingIndex = updatedMealPlan.items.findIndex(
                                              item => item.dayOfWeek === dayOfWeek && item.mealType === meal.mealType
                                            );

                                            if (existingIndex !== -1) {
                                              updatedMealPlan.items[existingIndex] = {
                                                ...updatedMealPlan.items[existingIndex],
                                                skipped: e.target.checked,
                                                skipReason: e.target.checked
                                                  ? (updatedMealPlan.items[existingIndex].skipReason || '')
                                                  : undefined
                                              };
                                            } else {
                                              updatedMealPlan.items.push({
                                                _id: `temp-${Date.now()}`,
                                                mealPlanId: selectedMealPlan._id,
                                                dayOfWeek: dayOfWeek as DayOfWeek,
                                                mealType: meal.mealType as MealType,
                                                items: [],
                                                skipped: e.target.checked,
                                                skipReason: e.target.checked ? '' : undefined
                                              });
                                            }

                                            setSelectedMealPlan(updatedMealPlan);
                                            const validation = validateMealPlan(updatedMealPlan.items);
                                            setMealPlanValidationErrors(validation.errors);
                                            if (validation.isValid) {
                                              setShowValidationErrors(false);
                                            }
                                          }}
                                        />
                                        <Typography variant="body2" color="text.secondary">
                                          Skip this meal
                                        </Typography>
                                      </Box>
                                      {isSkipped && (
                                        <TextField
                                          label="Skip reason"
                                          size="small"
                                          fullWidth
                                          value={skipReason}
                                          onChange={(e) => {
                                            if (!selectedMealPlan) return;
                                            const updatedMealPlan = { ...selectedMealPlan };
                                            const existingIndex = updatedMealPlan.items.findIndex(
                                              item => item.dayOfWeek === dayOfWeek && item.mealType === meal.mealType
                                            );

                                            if (existingIndex !== -1) {
                                              updatedMealPlan.items[existingIndex] = {
                                                ...updatedMealPlan.items[existingIndex],
                                                skipped: true,
                                                skipReason: e.target.value
                                              };
                                            } else {
                                              updatedMealPlan.items.push({
                                                _id: `temp-${Date.now()}`,
                                                mealPlanId: selectedMealPlan._id,
                                                dayOfWeek: dayOfWeek as DayOfWeek,
                                                mealType: meal.mealType as MealType,
                                                items: [],
                                                skipped: true,
                                                skipReason: e.target.value
                                              });
                                            }

                                            setSelectedMealPlan(updatedMealPlan);
                                          }}
                                        />
                                      )}
                                    </Box>
                                  )}

                                  {/* Only show MealEditor when meal is not explicitly skipped */}
                                  {!isSkipped && (
                                    <MealEditor
                                      mealItems={meal.items}
                                      onChange={(newItems) => {
                                        // Update the meal plan
                                        const updatedMealPlan = { ...selectedMealPlan };
                                        const existingMealPlanItemIndex = updatedMealPlan.items.findIndex(
                                          item => item.dayOfWeek === dayOfWeek && item.mealType === meal.mealType
                                        );
                                        
                                        // Always update the meal plan item, even if it's empty
                                        if (existingMealPlanItemIndex !== -1) {
                                          updatedMealPlan.items[existingMealPlanItemIndex] = {
                                            ...updatedMealPlan.items[existingMealPlanItemIndex],
                                            items: newItems
                                          };
                                        } else {
                                          // Create a new meal plan item even if it's empty (to allow adding items)
                                          updatedMealPlan.items.push({
                                            _id: `temp-${Date.now()}`,
                                            mealPlanId: selectedMealPlan._id,
                                            dayOfWeek: dayOfWeek as DayOfWeek,
                                            mealType: meal.mealType as MealType,
                                            items: newItems
                                          });
                                        }
                                        
                                        setSelectedMealPlan(updatedMealPlan);
                                        // Update validation immediately
                                        const validation = validateMealPlan(updatedMealPlan.items);
                                        setMealPlanValidationErrors(validation.errors);
                                        // Hide validation errors if they're resolved
                                        if (validation.isValid) {
                                          setShowValidationErrors(false);
                                        }
                                      }}
                                      onFoodItemAdded={handleAddFoodItem}
                                    />
                                  )}
                                </Box>
                              )})}
                            </Box>
                          </Paper>
                        );
                      })}
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {/* <Box>
                        <Typography variant="h6" gutterBottom>{selectedMealPlan.name}</Typography>
                      </Box> */}
                      <Divider />
                      
                      {/* Weekly Staples Section - Show once at the top */}
                      {(() => {
                        const staplesItems = selectedMealPlan.items.filter(item => item.mealType === 'staples');
                        if (staplesItems.length > 0) {
                          return (
                            <Paper 
                              elevation={1}
                              sx={{ 
                                mb: 3,
                                border: '1px solid',
                                borderColor: 'primary.main',
                                borderRadius: 2,
                                overflow: 'hidden'
                              }}
                            >
                              {/* Staples Header */}
                              <Box 
                                sx={{ 
                                  p: 2, 
                                  backgroundColor: 'primary.main',
                                  color: 'primary.contrastText',
                                  borderBottom: '1px solid',
                                  borderColor: 'divider'
                                }}
                              >
                                <Typography variant="h6" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
                                  Weekly Staples
                                </Typography>
                              </Box>
                              
                              {/* Staples Content */}
                              <Box sx={{ p: 3 }}>
                                {staplesItems[0].items.map((staple, index) => {
                                  if (staple.type === 'ingredientGroup') {
                                    // Render ingredient group
                                    return (
                                      <Box key={index} sx={{ mb: 1 }}>
                                        {staple.ingredients && staple.ingredients.map((group, groupIndex) => (
                                          <Box key={groupIndex} sx={{ mb: 1 }}>
                                            {group.title && (
                                              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                                {group.title}:
                                              </Typography>
                                            )}
                                            <Box sx={{ pl: 2 }}>
                                              {group.ingredients.map((ingredient, ingIndex) => (
                                                <Typography key={ingIndex} variant="body2" sx={{ mb: 0.5 }}>
                                                  • {ingredient.quantity} {ingredient.unit && ingredient.unit !== 'each' ? getUnitForm(ingredient.unit, ingredient.quantity) + ' ' : ''}{ingredient.name || 'Unknown'}
                                                </Typography>
                                              ))}
                                            </Box>
                                          </Box>
                                        ))}
                                      </Box>
                                    );
                                  } else {
                                    // Render regular staple item
                                    return (
                                      <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                                        • {staple.name}
                                        {staple.quantity && staple.unit && (
                                          <span style={{ color: 'text.secondary' }}>
                                            {' '}({staple.quantity} {getUnitForm(staple.unit, staple.quantity)})
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
                        const dayItems = selectedMealPlan.items.filter(item => item.dayOfWeek === dayOfWeek && item.mealType !== 'staples');
                        
                        return (
                          <Paper 
                            key={dayOfWeek} 
                            elevation={1}
                            sx={{ 
                               mb: 3,
                               border: '1px solid',
                               borderColor: 'divider',
                               borderRadius: 2,
                               overflow: 'hidden'
                             }}
                          >
                            {/* Day Header */}
                            <Box 
                              sx={{ 
                                p: 2, 
                                backgroundColor: 'primary.main',
                                color: 'primary.contrastText',
                                borderBottom: '1px solid',
                                borderColor: 'divider'
                              }}
                            >
                              <Typography variant="h6" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
                                {getDateForDay(dayOfWeek)}
                              </Typography>
                            </Box>
                            
                            {/* Day Content */}
                            <Box sx={{ p: 3 }}>
                              {(['breakfast', 'lunch', 'dinner'] as MealType[])
                                .filter(mealType => selectedMealPlan.template.meals[mealType])
                                .map((mealType) => {
                                  const mealItems = dayItems.filter(item => item.mealType === mealType);
                                  const mealPlanItem = mealItems[0];
                                  const isSkipped = mealPlanItem?.skipped ?? false;
                                  const skipReason = mealPlanItem?.skipReason ?? '';

                                  return (
                                    <Box key={mealType} sx={{ mb: 3 }}>
                                      <Typography 
                                        variant="subtitle1" 
                                        sx={{ 
                                          mb: 2, 
                                          fontWeight: 'bold',
                                          color: 'text.primary',
                                          borderBottom: '2px solid',
                                          borderColor: 'primary.light',
                                          pb: 0.5,
                                          display: 'inline-block'
                                        }}
                                      >
                                        {getMealTypeName(mealType)}
                                      </Typography>
                                      {isSkipped ? (
                                        <Typography variant="body2" color="text.secondary" sx={{ pl: 2, fontStyle: 'italic' }}>
                                          Skipped{skipReason ? `: ${skipReason}` : ''}
                                        </Typography>
                                      ) : mealItems.length > 0 ? (
                                        <Box sx={{ pl: 2 }}>
                                          {mealItems.map((item, index) => (
                                            <Box key={index}>
                                              {item.items.map((mealItem, mealIndex) => {
                                                if (mealItem.type === 'ingredientGroup') {
                                                  // Render ingredient group
                                                  return (
                                                    <Box key={mealIndex} sx={{ mb: 1 }}>
                                                      {mealItem.ingredients && mealItem.ingredients.map((group, groupIndex) => (
                                                        <Box key={groupIndex} sx={{ mb: 1 }}>
                                                          {group.title && (
                                                            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                                              {group.title}:
                                                            </Typography>
                                                          )}
                                                          <Box sx={{ pl: 2 }}>
                                                            {group.ingredients.map((ingredient, ingIndex) => (
                                                              <Typography key={ingIndex} variant="body2" sx={{ mb: 0.5 }}>
                                                                • {ingredient.quantity} {ingredient.unit && ingredient.unit !== 'each' ? getUnitForm(ingredient.unit, ingredient.quantity) + ' ' : ''}{ingredient.name || 'Unknown'}
                                                              </Typography>
                                                            ))}
                                                          </Box>
                                                        </Box>
                                                      ))}
                                                    </Box>
                                                  );
                                                } else {
                                                  // Render regular meal item (foodItem or recipe)
                                                  return (
                                                    <Typography key={mealIndex} variant="body2" sx={{ mb: 0.5 }}>
                                                      • {mealItem.name}
                                                      {mealItem.quantity && mealItem.unit && (
                                                        <span style={{ color: 'text.secondary' }}>
                                                          {' '}({mealItem.quantity} {getUnitForm(mealItem.unit, mealItem.quantity)})
                                                        </span>
                                                      )}
                                                    </Typography>
                                                  );
                                                }
                                              })}
                                              {item.notes && (
                                                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', ml: 2 }}>
                                                  Note: {item.notes}
                                                </Typography>
                                              )}
                                            </Box>
                                          ))}
                                        </Box>
                                      ) : (
                                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', pl: 2 }}>
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
                <Box sx={{ 
                  display: 'flex',
                  flexDirection: { xs: 'column-reverse', sm: 'row' },
                  gap: 1,
                  p: 2,
                  justifyContent: { xs: 'stretch', sm: 'flex-start' },
                  alignItems: { xs: 'stretch', sm: 'center' }
                }}>
                  <Button 
                    onClick={() => deleteConfirmDialog.openDialog()}
                    color="error"
                    variant="outlined"
                    startIcon={<Delete />}
                    sx={{ 
                      width: { xs: '100%', sm: 'auto' },
                      mr: { xs: 0, sm: 'auto' },
                      border: { sm: 'none' },
                      '&:hover': {
                        border: { sm: 'none' },
                        backgroundColor: { sm: 'rgba(211, 47, 47, 0.04)' }
                      }
                    }}
                  >
                    Delete
                  </Button>
                  <Button 
                    onClick={() => {
                      setEditMode(false);
                      viewDialog.removeDialogData('editMode');
                    }}
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => {
                      if (mealPlanValidationErrors.length > 0) {
                        setShowValidationErrors(true);
                      } else {
                        handleUpdateMealPlan();
                      }
                    }}
                    variant={mealPlanValidationErrors.length > 0 ? "outlined" : "contained"}
                    sx={{ 
                      width: { xs: '100%', sm: 'auto' },
                      ...(mealPlanValidationErrors.length > 0 && {
                        color: 'text.secondary',
                        borderColor: 'text.secondary'
                      })
                    }}
                  >
                    Save
                  </Button>
                </Box>
              )}
            </DialogContent>
          </Dialog>

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