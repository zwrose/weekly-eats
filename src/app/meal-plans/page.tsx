'use client';

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
  IconButton,
  Snackbar,
  List,
  ListItem,
  ListItemText,
  TextField,
  Divider,
} from '@mui/material';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';
import { useSession } from 'next-auth/react';
import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthenticatedLayout from '../../components/AuthenticatedLayout';
import {
  MealPlanWithTemplate,
  MealPlanTemplate,
  CreateMealPlanRequest,
  DayOfWeek,
  MealType,
  MealItem,
} from '../../types/meal-plan';

import {
  fetchMealPlans,
  createMealPlan,
  fetchMealPlanTemplate,
  updateMealPlanTemplate,
  DEFAULT_TEMPLATE,
} from '../../lib/meal-plan-utils';
import dynamic from 'next/dynamic';
import AddFoodItemDialog from '../../components/AddFoodItemDialog';
import { MealEditorDialog } from '@/components/meal-plans/MealEditorDialog';
const MealPlanCreateDialog = dynamic(() => import('@/components/MealPlanCreateDialog'), {
  ssr: false,
});
import { calculateEndDateAsString } from '../../lib/date-utils';
import { addDays } from 'date-fns';
import {
  checkMealPlanOverlap,
  findNextAvailableMealPlanStartDate,
} from '../../lib/meal-plan-utils';
import {
  inviteUserToMealPlanSharing,
  respondToMealPlanSharingInvitation,
  removeUserFromMealPlanSharing,
  fetchPendingMealPlanSharingInvitations,
  fetchSharedMealPlanUsers,
  fetchMealPlanOwners,
  SharedUser,
  PendingMealPlanInvitation,
} from '../../lib/meal-plan-sharing-utils';
import { useDialog, useConfirmDialog } from '@/lib/hooks';
import { responsiveDialogStyle } from '@/lib/theme';
import { DialogActions, DialogTitle } from '@/components/ui';
import { formatDateForAPI } from '../../lib/date-utils';
import MealPlanBrowser from '../../components/MealPlanBrowser';

// Compact section header used across the index (Current / Shared / Past).
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.16em',
        color: tokens.text.secondary,
        textTransform: 'uppercase',
        mb: 1,
      }}
    >
      {children}
    </Box>
  );
}

interface PlanRowProps {
  name: string;
  onClick: () => void;
}

// A single clickable plan row that navigates to the detail route.
function PlanRow({ name, onClick }: PlanRowProps) {
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1.75,
        mb: 1,
        cursor: 'pointer',
        borderRadius: `${tokens.radius.lg}px`,
        bgcolor: tokens.surface.raised,
        border: `1px solid ${tokens.border.subtle}`,
        transition: 'background-color 0.15s, border-color 0.15s',
        '&:hover': {
          bgcolor: tokens.surface.elevated,
          borderColor: tokens.border.strong,
        },
        '&:focus-visible': {
          outline: `2px solid ${tokens.section.plans}`,
          outlineOffset: 2,
        },
      }}
    >
      <Icon name="calendar_month" size={22} color={tokens.section.plans} />
      <Typography sx={{ fontSize: 15, color: tokens.text.primary }}>{name}</Typography>
    </Box>
  );
}

function MealPlansPageContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [mealPlans, setMealPlans] = useState<MealPlanWithTemplate[]>([]);
  const [pastPlans, setPastPlans] = useState<MealPlanWithTemplate[]>([]);
  const [template, setTemplate] = useState<MealPlanTemplate | null>(null);
  const createDialog = useDialog();
  const templateDialog = useDialog();
  const staplesEditorDialog = useDialog();

  // State for adding food items (legacy AddFoodItemDialog path)
  const [addFoodItemDialogOpen, setAddFoodItemDialogOpen] = useState(false);
  const [prefillFoodItemName] = useState('');

  // Create meal plan form state
  const [newMealPlan, setNewMealPlan] = useState<CreateMealPlanRequest>({
    startDate: '',
  });

  // Validation state
  const [validationError, setValidationError] = useState<string | null>(null);

  // Meal plan sharing state
  const shareDialog = useDialog();
  const leaveSharingConfirmDialog = useConfirmDialog();
  const [pendingMealPlanInvitations, setPendingMealPlanInvitations] = useState<
    PendingMealPlanInvitation[]
  >([]);
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]); // Users YOU invited (for sharing dialog)
  const [mealPlanOwners, setMealPlanOwners] = useState<SharedUser[]>([]); // Users who invited YOU
  const [shareEmail, setShareEmail] = useState('');
  const shareEmailRef = useRef<HTMLInputElement>(null);
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null); // For creating meal plans
  const [userSettings, setUserSettings] = useState<{ defaultMealPlanOwner?: string } | null>(null);

  // "View older" history browser toggle (collapsed by default)
  const [showHistory, setShowHistory] = useState(false);

  // Snackbar state
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
      staples: false, // Staples are managed separately
    },
    weeklyStaples: [],
  });

  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  const getOwnerName = (userId: string): string => {
    const owner = mealPlanOwners.find((u) => u.userId === userId);
    return owner?.name || owner?.email || 'Unknown User';
  };

  // State to track if we skipped a default due to overlap
  const [skippedDefault, setSkippedDefault] = useState<{
    skipped: boolean;
    skippedFrom?: string;
    earliestAvailable: string | null;
  } | null>(null);

  const navigateToPlan = useCallback(
    (plan: MealPlanWithTemplate) => {
      router.push(`/meal-plans/${plan._id}`);
    },
    [router]
  );

  // Redirect legacy ?viewMealPlan deep-links to the new detail route.
  useEffect(() => {
    if (searchParams.get('viewMealPlan')) {
      const id = searchParams.get('viewMealPlan_mealPlanId');
      router.replace(id ? `/meal-plans/${id}` : '/meal-plans');
    }
  }, [searchParams, router]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch current meal plans (those that include today or future dates)
      const today = formatDateForAPI(new Date());
      // Past window: last 6 weeks (42 days ago through yesterday).
      const pastStart = formatDateForAPI(addDays(new Date(), -42));
      const pastEnd = formatDateForAPI(addDays(new Date(), -1));

      const [plans, past, userTemplate, pendingInvites, invitedUsers, owners, settingsResponse] =
        await Promise.all([
          fetchMealPlans({ minEndDate: today }),
          fetchMealPlans({ startDate: pastStart, endDate: pastEnd }),
          fetchMealPlanTemplate(),
          fetchPendingMealPlanSharingInvitations(),
          fetchSharedMealPlanUsers(), // Users YOU invited
          fetchMealPlanOwners(), // Users who invited YOU
          fetch('/api/user/settings').then((res) => res.json()),
        ]);
      setMealPlans(plans);
      // The past-window query (overlaps [42d ago, yesterday]) also returns plans that
      // merely *started* in that window but end today/later — those are current, not past.
      // Exclude anything already in the current set so a plan never appears in both sections.
      const currentIds = new Set(plans.map((p) => p._id));
      setPastPlans(
        [...past]
          .filter((p) => !currentIds.has(p._id))
          .sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0))
      );
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
            staples: false, // Staples are managed separately
          },
          weeklyStaples: userTemplate.weeklyStaples || [],
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
      setShareEmail('');
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
    const owner = mealPlanOwners.find((u) => u.userId === ownerId);
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
    const { startDate, skipped, skippedFrom } = findNextAvailableMealPlanStartDate(
      startDay,
      mealPlans
    );
    setNewMealPlan({ startDate });
    setSkippedDefault(skipped ? { skipped, skippedFrom, earliestAvailable: startDate } : null);

    // Use default owner from settings if available and valid
    let defaultOwner = currentUserId || null;
    if (userSettings?.defaultMealPlanOwner) {
      const isValidOwner =
        userSettings.defaultMealPlanOwner === currentUserId ||
        mealPlanOwners.some((o) => o.userId === userSettings.defaultMealPlanOwner);
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
      const payload: CreateMealPlanRequest & { ownerId?: string } = {
        ...newMealPlan,
        ownerId: targetOwner ?? undefined,
      };
      await createMealPlan(payload);
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
      showSnackbar('Failed to update template', 'error');
    }
  };

  const handleAddFoodItem = async (
    foodItemData:
      | {
          name: string;
          singularName: string;
          pluralName: string;
          unit: string;
          isGlobal: boolean;
          addToPantry?: boolean;
        }
      | {
          _id: string;
          name: string;
          singularName: string;
          pluralName: string;
          unit: string;
          isGlobal: boolean;
        }
  ) => {
    // Already-created food item (passed from IngredientInput) — just close.
    if ('_id' in foodItemData) {
      setAddFoodItemDialogOpen(false);
      return;
    }

    // Raw form data that needs to be created (legacy direct dialog usage)
    try {
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

        if (response.status === 409 && errorData.error === 'Food item already exists') {
          const details =
            errorData.details ||
            'A food item with this name already exists. Please choose a different name.';
          showSnackbar(details, 'error');
          return;
        }

        throw new Error(errorData.error || 'Failed to add food item');
      }

      const newFoodItem = await response.json();

      if (addToPantry && newFoodItem._id) {
        try {
          const { createPantryItem } = await import('../../lib/pantry-utils');
          await createPantryItem({ foodItemId: newFoodItem._id });
        } catch (pantryError) {
          console.error('Error adding food item to pantry:', pantryError);
        }
      }

      setAddFoodItemDialogOpen(false);
    } catch (error) {
      console.error('Error adding food item:', error);
      showSnackbar('Failed to add food item', 'error');
    }
  };

  // MealEditorDialog requires a FoodItem-shaped callback; the staples editor only
  // needs items to land in the draft, so this is a no-op (matches PlanDetail).
  const noopFoodItemAdded = useCallback(async () => {}, []);

  // Check for overlapping meal plans
  const checkForOverlaps = useCallback(
    (startDate: string): string | null => {
      if (!startDate) return null;

      const overlapResult = checkMealPlanOverlap(startDate, mealPlans);
      if (overlapResult.isOverlapping && overlapResult.conflict) {
        return `This meal plan (${startDate} to ${calculateEndDateAsString(startDate)}) would overlap with "${overlapResult.conflict.planName}" (${overlapResult.conflict.startDate} to ${overlapResult.conflict.endDate})`;
      }

      return null;
    },
    [mealPlans]
  );

  // Update validation when start date changes
  useEffect(() => {
    const error = checkForOverlaps(newMealPlan.startDate);
    setValidationError(error);

    if (newMealPlan.startDate) {
      const startDay = template ? template.startDay : DEFAULT_TEMPLATE.startDay;
      const { startDate, skippedFrom } = findNextAvailableMealPlanStartDate(startDay, mealPlans);

      if (startDate !== newMealPlan.startDate) {
        setSkippedDefault({
          skipped: true,
          skippedFrom: skippedFrom || newMealPlan.startDate,
          earliestAvailable: startDate,
        });
      } else if (skippedFrom) {
        setSkippedDefault({
          skipped: true,
          skippedFrom: skippedFrom,
          earliestAvailable: startDate,
        });
      } else {
        setSkippedDefault(null);
      }
    } else {
      setSkippedDefault(null);
    }
  }, [newMealPlan.startDate, checkForOverlaps, template, mealPlans]);

  // Plans you own that are current/upcoming.
  const currentPlans = mealPlans.filter((p) => p.userId === currentUserId);
  // Plans shared with you, grouped by owner.
  const sharedByOwner: Record<string, MealPlanWithTemplate[]> = {};
  mealPlans
    .filter((p) => p.userId !== currentUserId)
    .forEach((p) => {
      (sharedByOwner[p.userId] ??= []).push(p);
    });
  const sharedOwnerIds = Object.keys(sharedByOwner);

  // Show loading state while session is being fetched
  if (status === 'loading') {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="md">
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      </AuthenticatedLayout>
    );
  }

  // Only redirect if session is definitely not available
  if (status === 'unauthenticated') {
    return null; // Will be handled by AuthenticatedLayout
  }

  const pendingCount = pendingMealPlanInvitations.length;

  return (
    <AuthenticatedLayout>
      <Container maxWidth="md">
        <Box sx={{ py: { xs: 1.5, md: 3 } }}>
          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
              mb: { xs: 2.5, md: 3.5 },
            }}
          >
            <Typography
              component="h1"
              sx={{
                fontFamily: 'var(--font-display)',
                fontSize: { xs: 26, md: 32 },
                fontWeight: 700,
                color: tokens.text.primary,
                lineHeight: 1.1,
              }}
            >
              Your plans
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <IconButton
                aria-label="Template settings"
                onClick={() => templateDialog.openDialog()}
                sx={{ color: tokens.text.secondary }}
              >
                <Icon name="settings" size={22} />
              </IconButton>
              <IconButton
                aria-label="Share meal plans"
                onClick={() => shareDialog.openDialog()}
                sx={{ color: tokens.text.secondary, position: 'relative' }}
              >
                <Icon name="group" size={22} />
                {pendingCount > 0 && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: tokens.state.danger,
                    }}
                  />
                )}
              </IconButton>
              <Button
                variant="contained"
                startIcon={<Icon name="add" size={20} />}
                onClick={handleOpenCreateDialog}
                sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                New plan
              </Button>
            </Box>
          </Box>

          {/* Pending invitations */}
          {pendingCount > 0 && (
            <Box sx={{ mb: 3 }}>
              <SectionLabel>Invitations</SectionLabel>
              <List disablePadding>
                {pendingMealPlanInvitations.map((inv) => (
                  <ListItem
                    key={inv.ownerId}
                    sx={{
                      bgcolor: tokens.surface.raised,
                      border: `1px solid ${tokens.border.subtle}`,
                      borderRadius: `${tokens.radius.lg}px`,
                      mb: 1,
                    }}
                    secondaryAction={
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          title="Accept"
                          aria-label="Accept invitation"
                          onClick={() => handleAcceptMealPlanInvitation(inv.invitation.userId)}
                          sx={{ color: tokens.state.success }}
                        >
                          <Icon name="check" size={18} />
                        </IconButton>
                        <IconButton
                          size="small"
                          title="Reject"
                          aria-label="Reject invitation"
                          onClick={() => handleRejectMealPlanInvitation(inv.invitation.userId)}
                          sx={{ color: tokens.state.danger }}
                        >
                          <Icon name="close" size={18} />
                        </IconButton>
                      </Box>
                    }
                  >
                    <ListItemText
                      primary={`${inv.ownerName || inv.ownerEmail}'s Meal Plans`}
                      secondary={`Invited ${new Date(inv.invitation.invitedAt).toLocaleDateString()}`}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress sx={{ color: tokens.section.plans }} />
            </Box>
          ) : (
            <>
              {/* Current */}
              <Box sx={{ mb: 4 }}>
                <SectionLabel>
                  Current{' '}
                  {currentPlans.length > 0 && (
                    <Box component="span" sx={{ color: 'primary.main' }}>
                      · {currentPlans.length}
                    </Box>
                  )}
                </SectionLabel>
                {currentPlans.length > 0 ? (
                  currentPlans.map((plan) => (
                    <PlanRow key={plan._id} name={plan.name} onClick={() => navigateToPlan(plan)} />
                  ))
                ) : (
                  <Box sx={{ fontSize: 14, color: tokens.text.secondary, py: 1 }}>
                    No current plans. Create your first plan to get started.
                  </Box>
                )}
              </Box>

              {/* Shared with you */}
              {sharedOwnerIds.length > 0 && (
                <Box sx={{ mb: 4 }}>
                  <SectionLabel>Shared with you</SectionLabel>
                  {sharedOwnerIds.map((ownerId) => (
                    <Box key={ownerId} sx={{ mb: 2 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          mb: 1,
                        }}
                      >
                        <Typography sx={{ fontSize: 13, color: tokens.text.secondary }}>
                          {getOwnerName(ownerId)}
                        </Typography>
                        <Button
                          size="small"
                          onClick={() => handleLeaveSharedMealPlans(ownerId)}
                          sx={{
                            textTransform: 'none',
                            color: tokens.state.danger,
                            minWidth: 'auto',
                          }}
                        >
                          Leave
                        </Button>
                      </Box>
                      {sharedByOwner[ownerId].map((plan) => (
                        <PlanRow
                          key={plan._id}
                          name={plan.name}
                          onClick={() => navigateToPlan(plan)}
                        />
                      ))}
                    </Box>
                  ))}
                </Box>
              )}

              {/* Past · last 6 weeks */}
              {pastPlans.length > 0 && (
                <Box sx={{ mb: 4 }}>
                  <SectionLabel>
                    Past · last 6 weeks{' '}
                    <Box component="span" sx={{ color: 'primary.main' }}>
                      · {pastPlans.length}
                    </Box>
                  </SectionLabel>
                  {pastPlans.map((plan) => (
                    <PlanRow key={plan._id} name={plan.name} onClick={() => navigateToPlan(plan)} />
                  ))}
                </Box>
              )}

              {/* View older → history browser */}
              <Box sx={{ mb: 4 }}>
                {!showHistory ? (
                  <Button
                    onClick={() => setShowHistory(true)}
                    sx={{
                      textTransform: 'none',
                      color: tokens.section.plans,
                      fontWeight: 600,
                      px: 0,
                    }}
                  >
                    View older →
                  </Button>
                ) : (
                  <Box>
                    <SectionLabel>All history</SectionLabel>
                    <MealPlanBrowser onPlanSelect={navigateToPlan} />
                  </Box>
                )}
              </Box>
            </>
          )}

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
            maxWidth="sm"
            fullWidth
            sx={responsiveDialogStyle}
          >
            <DialogTitle onClose={templateDialog.closeDialog}>Template Settings</DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2 }}>
                {mealPlanOwners.length > 0 && (
                  <Alert severity="info" sx={{ mb: 3 }}>
                    <Typography variant="body2">
                      Editing your own template. To edit a shared user&apos;s template, create or
                      edit one of their meal plans.
                    </Typography>
                  </Alert>
                )}

                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>Start Day</InputLabel>
                  <Select
                    value={templateForm.startDay}
                    label="Start Day"
                    onChange={(e) =>
                      setTemplateForm({ ...templateForm, startDay: e.target.value as DayOfWeek })
                    }
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
                        onChange={(e) =>
                          setTemplateForm({
                            ...templateForm,
                            meals: { ...templateForm.meals, [meal]: e.target.checked },
                          })
                        }
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
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                  }}
                >
                  <Typography variant="body2" sx={{ color: tokens.text.secondary }}>
                    {templateForm.weeklyStaples.length === 0
                      ? 'No staples yet'
                      : `${templateForm.weeklyStaples.length} ${
                          templateForm.weeklyStaples.length === 1 ? 'item' : 'items'
                        }`}
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => staplesEditorDialog.openDialog()}
                    sx={{ textTransform: 'none' }}
                  >
                    Edit staples
                  </Button>
                </Box>
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

          {/* Staples Editor (nested in template flow) */}
          <MealEditorDialog
            isStaples
            open={staplesEditorDialog.open}
            title="Weekly staples"
            meal={{ items: templateForm.weeklyStaples, skipped: false, skipReason: '' }}
            onSave={(next) => {
              setTemplateForm({ ...templateForm, weeklyStaples: next.items });
              staplesEditorDialog.closeDialog();
            }}
            onClose={() => staplesEditorDialog.closeDialog()}
            onFoodItemAdded={noopFoodItemAdded}
          />

          {/* Leave Sharing Confirmation Dialog */}
          <Dialog
            open={leaveSharingConfirmDialog.open}
            onClose={leaveSharingConfirmDialog.closeDialog}
            sx={responsiveDialogStyle}
          >
            <DialogTitle onClose={leaveSharingConfirmDialog.closeDialog}>
              Leave Shared Meal Plans
            </DialogTitle>
            <DialogContent>
              <Typography>
                Are you sure you want to leave{' '}
                {(leaveSharingConfirmDialog.data as { ownerName: string } | null)?.ownerName}
                &apos;s meal plans? You will no longer be able to view or edit their meal plans.
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
            <DialogTitle onClose={shareDialog.closeDialog}>Share Meal Plans</DialogTitle>
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
                        <ListItemText primary={user.name || user.email} secondary={user.email} />
                        <IconButton
                          size="small"
                          color="error"
                          title="Remove user"
                          aria-label="Remove user"
                          onClick={() => handleRemoveMealPlanUser(user.userId)}
                        >
                          <Icon name="delete" size={18} />
                        </IconButton>
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              <DialogActions primaryButtonIndex={0}>
                <Button
                  onClick={shareDialog.closeDialog}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
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
            <Alert
              onClose={handleCloseSnackbar}
              severity={snackbar.severity}
              sx={{ width: '100%' }}
            >
              {snackbar.message}
            </Alert>
          </Snackbar>
        </Box>
      </Container>
    </AuthenticatedLayout>
  );
}

export default function MealPlansPage() {
  return (
    <Suspense
      fallback={
        <AuthenticatedLayout>
          <Container maxWidth="md">
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          </Container>
        </AuthenticatedLayout>
      }
    >
      <MealPlansPageContent />
    </Suspense>
  );
}
