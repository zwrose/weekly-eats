'use client';

import {
  Container,
  Typography,
  Box,
  Button,
  Dialog,
  DialogContent,
  Alert,
  Divider,
  IconButton,
  Snackbar,
  List,
  ListItem,
  ListItemText,
  TextField,
  Skeleton,
} from '@mui/material';
import {
  Add,
  CalendarMonth,
  Settings,
  Delete,
  Share,
  Check,
  Close as CloseIcon,
  PersonAdd,
} from '@mui/icons-material';
import { useSession } from 'next-auth/react';
import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
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
const MealPlanCreateDialog = dynamic(() => import('@/components/MealPlanCreateDialog'), {
  ssr: false,
});
import { calculateEndDateAsString } from '../../lib/date-utils';
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
import { DialogActions, DialogTitle, ListRow, StaggeredList } from '@/components/ui';
import { formatDateForAPI } from '../../lib/date-utils';
import MealPlanBrowser from '../../components/MealPlanBrowser';

function MealPlansPageContent() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mealPlans, setMealPlans] = useState<MealPlanWithTemplate[]>([]);
  const [template, setTemplate] = useState<MealPlanTemplate | null>(null);
  const createDialog = useDialog();
  const leaveSharingConfirmDialog = useConfirmDialog();

  // Create meal plan form state
  const [newMealPlan, setNewMealPlan] = useState<CreateMealPlanRequest>({
    startDate: '',
  });

  // Validation state
  const [validationError, setValidationError] = useState<string | null>(null);

  // Meal plan sharing state
  const shareDialog = useDialog();
  const [pendingMealPlanInvitations, setPendingMealPlanInvitations] = useState<
    PendingMealPlanInvitation[]
  >([]);
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);
  const [mealPlanOwners, setMealPlanOwners] = useState<SharedUser[]>([]);
  const [shareEmail, setShareEmail] = useState('');
  const shareEmailRef = useRef<HTMLInputElement>(null);
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null);
  const [userSettings, setUserSettings] = useState<{ defaultMealPlanOwner?: string } | null>(null);

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

  // Organize meal plans by owner
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  const mealPlansByOwner = () => {
    const grouped: Record<string, MealPlanWithTemplate[]> = {};

    mealPlans.forEach((plan) => {
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
    const owner = mealPlanOwners.find((u) => u.userId === userId);
    return `Shared by ${owner?.name || owner?.email || 'Unknown User'}`;
  };

  // State to track if we skipped a default due to overlap
  const [skippedDefault, setSkippedDefault] = useState<{
    skipped: boolean;
    skippedFrom?: string;
    earliestAvailable: string | null;
  } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const today = formatDateForAPI(new Date());

      const [plans, userTemplate, pendingInvites, invitedUsers, owners, settingsResponse] =
        await Promise.all([
          fetchMealPlans({ minEndDate: today }),
          fetchMealPlanTemplate(),
          fetchPendingMealPlanSharingInvitations(),
          fetchSharedMealPlanUsers(),
          fetchMealPlanOwners(),
          fetch('/api/user/settings').then((res) => res.json()),
        ]);
      setMealPlans(plans);
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
      await createMealPlan({ ...newMealPlan, ownerId: targetOwner } as CreateMealPlanRequest & {
        ownerId?: string;
      });
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

  // Navigate to meal plan detail page
  const handleMealPlanClick = (mealPlan: MealPlanWithTemplate) => {
    router.push(`/meal-plans/${mealPlan._id}`);
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

  if (status === 'loading') {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="xl">
          <Box sx={{ py: { xs: 0.5, md: 1 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: { xs: 1.5, md: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Skeleton variant="circular" width={28} height={28} />
                <Skeleton variant="text" width={100} height={28} />
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Skeleton variant="rounded" width={140} height={32} />
                <Skeleton variant="rounded" width={32} height={32} />
              </Box>
            </Box>
            <Skeleton variant="text" width={120} height={16} sx={{ mb: 1 }} />
            {[0, 1, 2].map((i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderBottom: '1px solid', borderBottomColor: 'divider' }}>
                <Skeleton variant="rounded" width={20} height={20} />
                <Skeleton variant="text" width={`${[55, 45, 60][i]}%`} height={20} />
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

  return (
    <AuthenticatedLayout>
      <Container maxWidth="xl">
        <Box sx={{ py: { xs: 0.5, md: 1 } }}>
          {/* Compact page header */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: { xs: 1.5, md: 2 },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarMonth sx={{ fontSize: { xs: 24, sm: 32 }, color: '#5b9bd5' }} />
              <Typography
                variant="h5"
                component="h1"
                sx={{ fontSize: '1.125rem', fontWeight: 600 }}
              >
                Meal Plans
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {/* Mobile: icon-only add button */}
              <IconButton
                onClick={handleOpenCreateDialog}
                size="small"
                sx={{
                  display: { xs: 'flex', sm: 'none' },
                  bgcolor: '#5b9bd5',
                  color: 'white',
                  width: 32,
                  height: 32,
                  '&:hover': { bgcolor: '#4a82b5' },
                }}
              >
                <Add sx={{ fontSize: 18 }} />
              </IconButton>
              {/* Desktop: full add button */}
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleOpenCreateDialog}
                size="small"
                sx={{
                  display: { xs: 'none', sm: 'flex' },
                  bgcolor: '#5b9bd5',
                  '&:hover': { bgcolor: '#4a82b5' },
                }}
              >
                Create Meal Plan
              </Button>
              <IconButton
                onClick={() => router.push('/meal-plans/settings')}
                size="small"
                sx={{
                  color: '#5b9bd5',
                  width: 32,
                  height: 32,
                }}
                aria-label="Template settings"
              >
                <Settings sx={{ fontSize: 18 }} />
              </IconButton>
              <IconButton
                onClick={() => shareDialog.openDialog()}
                size="small"
                sx={{
                  color: '#5b9bd5',
                  width: 32,
                  height: 32,
                }}
                aria-label="Share meal plans"
              >
                <Share sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          </Box>

          {/* Pending Meal Plan Sharing Invitations */}
          {pendingMealPlanInvitations.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography
                variant="subtitle2"
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}
              >
                <PersonAdd sx={{ fontSize: 16 }} />
                Pending Invitations ({pendingMealPlanInvitations.length})
              </Typography>
              <List disablePadding>
                {pendingMealPlanInvitations.map((inv) => (
                  <Box key={inv.ownerId}>
                    <ListItem sx={{ px: 1.5, py: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                        <ListItemText
                          primary={`${inv.ownerName || inv.ownerEmail}'s Meal Plans`}
                          secondary={`Invited ${new Date(inv.invitation.invitedAt).toLocaleDateString()}`}
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                          color="success"
                          size="small"
                          title="Accept"
                          onClick={() => handleAcceptMealPlanInvitation(inv.invitation.userId)}
                        >
                          <Check sx={{ fontSize: 16 }} />
                        </IconButton>
                        <IconButton
                          color="error"
                          size="small"
                          title="Reject"
                          onClick={() => handleRejectMealPlanInvitation(inv.invitation.userId)}
                        >
                          <CloseIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Box>
                    </ListItem>
                    <Divider />
                  </Box>
                ))}
              </List>
            </Box>
          )}

          {/* Current Meal Plans */}
          {loading ? (
            <Box sx={{ py: 1 }}>
              <Skeleton variant="text" width={120} height={16} sx={{ mb: 1 }} />
              {[0, 1, 2].map((i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderBottom: '1px solid', borderBottomColor: 'divider' }}>
                  <Skeleton variant="rounded" width={20} height={20} />
                  <Skeleton variant="text" width={`${[55, 45, 60][i]}%`} height={20} />
                </Box>
              ))}
            </Box>
          ) : mealPlans.length > 0 ? (
            <>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 1, fontSize: '0.75rem' }}
              >
                {mealPlans.length} current meal plan{mealPlans.length !== 1 ? 's' : ''}
              </Typography>

              {Object.entries(mealPlansByOwner()).map(
                ([ownerId, ownerMealPlans], sectionIndex) => {
                  const owners = Object.keys(mealPlansByOwner());
                  const hasMultipleOwners = owners.length > 1;
                  const isOnlyOwnerAndNotCurrentUser =
                    owners.length === 1 && ownerId !== currentUserId;
                  const shouldShowHeader = hasMultipleOwners || isOnlyOwnerAndNotCurrentUser;

                  return (
                    <Box
                      key={ownerId}
                      sx={{
                        mb:
                          sectionIndex < Object.keys(mealPlansByOwner()).length - 1 ? 2 : 0,
                      }}
                    >
                      {shouldShowHeader && (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            mb: 1,
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            color="text.secondary"
                          >
                            {getOwnerName(ownerId)}
                          </Typography>
                          {ownerId !== currentUserId && (
                            <Button
                              variant="text"
                              size="small"
                              color="error"
                              onClick={() => handleLeaveSharedMealPlans(ownerId)}
                              sx={{ fontSize: '0.75rem' }}
                            >
                              Leave
                            </Button>
                          )}
                        </Box>
                      )}

                      <StaggeredList>
                        {ownerMealPlans.map((mealPlan) => (
                          <ListRow
                            key={mealPlan._id}
                            onClick={() => handleMealPlanClick(mealPlan)}
                            accentColor="#5b9bd5"
                          >
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                width: '100%',
                                minWidth: 0,
                              }}
                            >
                              <CalendarMonth
                                sx={{ fontSize: 20, color: 'text.secondary', flexShrink: 0 }}
                              />
                              <Typography
                                variant="body2"
                                sx={{
                                  flex: 1,
                                  minWidth: 0,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  fontWeight: 500,
                                }}
                              >
                                {mealPlan.name}
                              </Typography>
                            </Box>
                          </ListRow>
                        ))}
                      </StaggeredList>
                    </Box>
                  );
                }
              )}
            </>
          ) : (
            <Alert severity="info">
              No current meal plans. Create your first meal plan to get started!
            </Alert>
          )}

          {/* Meal Plan History Browser */}
          <Box sx={{ mt: 3 }}>
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{ mb: 1 }}
            >
              Meal Plan History
            </Typography>
            <MealPlanBrowser onPlanSelect={handleMealPlanClick} />
          </Box>

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
          <Container maxWidth="xl">
            <Box sx={{ py: { xs: 0.5, md: 1 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: { xs: 1.5, md: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Skeleton variant="circular" width={28} height={28} />
                  <Skeleton variant="text" width={100} height={28} />
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Skeleton variant="rounded" width={140} height={32} />
                  <Skeleton variant="rounded" width={32} height={32} />
                </Box>
              </Box>
              <Skeleton variant="text" width={120} height={16} sx={{ mb: 1 }} />
              {[0, 1, 2].map((i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderBottom: '1px solid', borderBottomColor: 'divider' }}>
                  <Skeleton variant="rounded" width={20} height={20} />
                  <Skeleton variant="text" width={`${[55, 45, 60][i]}%`} height={20} />
                </Box>
              ))}
            </Box>
          </Container>
        </AuthenticatedLayout>
      }
    >
      <MealPlansPageContent />
    </Suspense>
  );
}
