'use client';

import {
  Container,
  Typography,
  Box,
  Button,
  Dialog,
  DialogContent,
  CircularProgress,
  Alert,
  IconButton,
  Snackbar,
} from '@mui/material';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';
import { useSession } from 'next-auth/react';
import { useState, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthenticatedLayout from '../../components/AuthenticatedLayout';
import {
  MealPlanWithTemplate,
  MealPlanTemplate,
  CreateMealPlanRequest,
} from '../../types/meal-plan';

import {
  fetchMealPlans,
  createMealPlan,
  fetchMealPlanTemplate,
  DEFAULT_TEMPLATE,
} from '../../lib/meal-plan-utils';
import dynamic from 'next/dynamic';
import AddFoodItemDialog from '../../components/AddFoodItemDialog';
const ShareMealPlansDialog = dynamic(
  () => import('@/components/meal-plans/ShareMealPlansDialog').then((m) => m.ShareMealPlansDialog),
  { ssr: false }
);
const MealPlanCreateDialog = dynamic(() => import('@/components/MealPlanCreateDialog'), {
  ssr: false,
});
import { calculateEndDateAsString, parseLocalDate } from '@/lib/date-utils';
import { addDays, format } from 'date-fns';
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
import { formatDateForAPI } from '@/lib/date-utils';
import MealPlanBrowser from '../../components/MealPlanBrowser';

// Bordered ghost-icon square used for the header actions (settings / share).
const ghostIconSx = {
  width: 38,
  height: 38,
  borderRadius: `${tokens.radius.lg}px`,
  border: `1px solid ${tokens.border.subtle}`,
  color: tokens.text.secondary,
  '&:hover': {
    bgcolor: tokens.surface.elevated,
    borderColor: tokens.border.strong,
    color: tokens.text.primary,
  },
};

// Compact section header used across the index (Current / Shared / Past): uppercase label,
// a divider rule that fills the row, and an optional accent count on the right.
function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  const labelSx = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.16em',
    textTransform: 'uppercase' as const,
  };
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
      <Box sx={{ ...labelSx, color: tokens.text.secondary, whiteSpace: 'nowrap' }}>{children}</Box>
      <Box sx={{ flex: 1, height: '1px', bgcolor: tokens.border.subtle }} />
      {count != null && <Box sx={{ ...labelSx, color: 'primary.main' }}>{count}</Box>}
    </Box>
  );
}

interface PlanRowProps {
  name: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
  onClick: () => void;
}

// A single clickable plan row that navigates to the detail route: accent calendar tile,
// plan name in the display font, a date-range subtitle, a CURRENT pill + accent glow when
// it's the active week, and a trailing chevron.
function PlanRow({ name, startDate, endDate, isCurrent, onClick }: PlanRowProps) {
  const range =
    startDate && endDate
      ? `${format(parseLocalDate(startDate), 'EEE, MMM d')} – ${format(parseLocalDate(endDate), 'EEE, MMM d')}`
      : null;
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
        py: 1.5,
        mb: 1,
        cursor: 'pointer',
        borderRadius: `${tokens.radius.lg}px`,
        bgcolor: tokens.surface.raised,
        border: `1px solid ${isCurrent ? `${tokens.section.plans}55` : tokens.border.subtle}`,
        boxShadow: isCurrent ? tokens.shadow.card : 'none',
        transition: 'background-color 0.15s, border-color 0.15s',
        '&:hover': {
          bgcolor: tokens.surface.elevated,
          borderColor: isCurrent ? `${tokens.section.plans}55` : tokens.border.strong,
        },
        '&:focus-visible': {
          outline: `2px solid ${tokens.section.plans}`,
          outlineOffset: 2,
        },
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: `${tokens.radius.lg}px`,
          bgcolor: tokens.accent.muted,
        }}
      >
        <Icon name="calendar_month" size={20} color={tokens.section.plans} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              fontWeight: 700,
              color: tokens.text.primary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </Typography>
          {isCurrent && (
            <Box
              component="span"
              sx={{
                flexShrink: 0,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: tokens.section.plans,
                bgcolor: tokens.accent.muted,
                px: 0.75,
                py: 0.25,
                borderRadius: `${tokens.radius.pill}px`,
                lineHeight: 1.5,
              }}
            >
              Current
            </Box>
          )}
        </Box>
        {range && (
          <Typography sx={{ fontSize: 12, color: tokens.text.secondary, mt: 0.25 }}>
            {range}
          </Typography>
        )}
      </Box>
      <Icon name="chevron_right" size={20} color={tokens.text.muted} />
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
                fontSize: { xs: 26, md: 30 },
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
                onClick={() => router.push('/meal-plans/template')}
                sx={ghostIconSx}
              >
                <Icon name="settings" size={20} />
              </IconButton>
              <IconButton
                aria-label="Share meal plans"
                onClick={() => shareDialog.openDialog()}
                sx={{ ...ghostIconSx, position: 'relative' }}
              >
                <Icon name="group" size={20} />
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
                sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap', minHeight: 38 }}
              >
                New plan
              </Button>
            </Box>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress sx={{ color: tokens.section.plans }} />
            </Box>
          ) : (
            <>
              {/* Current */}
              <Box sx={{ mb: 4 }}>
                <SectionLabel count={currentPlans.length > 0 ? currentPlans.length : undefined}>
                  Current
                </SectionLabel>
                {currentPlans.length > 0 ? (
                  currentPlans.map((plan) => (
                    <PlanRow
                      key={plan._id}
                      name={plan.name}
                      startDate={plan.startDate}
                      endDate={plan.endDate}
                      isCurrent
                      onClick={() => navigateToPlan(plan)}
                    />
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
                          startDate={plan.startDate}
                          endDate={plan.endDate}
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
                  <SectionLabel count={pastPlans.length}>Past · last 6 weeks</SectionLabel>
                  {pastPlans.map((plan) => (
                    <PlanRow
                      key={plan._id}
                      name={plan.name}
                      startDate={plan.startDate}
                      endDate={plan.endDate}
                      onClick={() => navigateToPlan(plan)}
                    />
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

          {/* Share Meal Plans — designed sheet (mobile) / dialog (desktop) */}
          <ShareMealPlansDialog
            open={shareDialog.open}
            onClose={shareDialog.closeDialog}
            pendingInvitations={pendingMealPlanInvitations}
            sharedUsers={sharedUsers}
            email={shareEmail}
            onEmailChange={setShareEmail}
            onInvite={handleInviteUser}
            onAccept={(userId) => handleAcceptMealPlanInvitation(userId)}
            onReject={(userId) => handleRejectMealPlanInvitation(userId)}
            onRemove={(userId) => handleRemoveMealPlanUser(userId)}
          />

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
