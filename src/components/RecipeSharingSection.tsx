'use client';

import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Divider,
  Paper,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { Check, Close as CloseIcon, PersonAdd } from '@mui/icons-material';
import { ShareDialog } from '@/components/ui';
import { PendingRecipeInvitation, SharedUser } from '@/lib/recipe-sharing-utils';

export interface RecipeSharingSectionProps {
  // Pending invitations
  pendingInvitations: PendingRecipeInvitation[] | null;
  onAcceptInvitation: (userId: string) => void;
  onRejectInvitation: (userId: string) => void;
  // Share dialog
  shareDialogOpen: boolean;
  onShareDialogClose: () => void;
  shareEmail: string;
  onShareEmailChange: (email: string) => void;
  shareTags: boolean;
  onShareTagsChange: (checked: boolean) => void;
  shareRatings: boolean;
  onShareRatingsChange: (checked: boolean) => void;
  onInviteUser: () => void;
  sharedUsers: SharedUser[];
  onRemoveUser: (userId: string) => void;
}

const RecipeSharingSection: React.FC<RecipeSharingSectionProps> = ({
  pendingInvitations,
  onAcceptInvitation,
  onRejectInvitation,
  shareDialogOpen,
  onShareDialogClose,
  shareEmail,
  onShareEmailChange,
  shareTags,
  onShareTagsChange,
  shareRatings,
  onShareRatingsChange,
  onInviteUser,
  sharedUsers,
  onRemoveUser,
}) => {
  const mappedUsers = sharedUsers.map((user) => ({
    key: user.userId,
    primary: user.name || user.email,
    secondary: `${user.email} - Sharing: ${user.sharingTypes.join(', ')}`,
  }));

  return (
    <>
      {/* Pending Recipe Sharing Invitations */}
      {pendingInvitations && pendingInvitations.length > 0 && (
        <Paper sx={{ p: 3, mb: 4, maxWidth: 'md', mx: 'auto' }}>
          <Typography
            variant="h6"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <PersonAdd />
            Pending Recipe Sharing Invitations ({pendingInvitations?.length || 0})
          </Typography>
          <List>
            {pendingInvitations?.map((inv) => (
              <Box key={inv.ownerId}>
                <ListItem>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      flex: 1,
                    }}
                  >
                    <ListItemText
                      primary={`${inv.ownerName || inv.ownerEmail}'s Recipe Data`}
                      secondary={
                        <>
                          {`Invited ${new Date(inv.invitation.invitedAt).toLocaleDateString()}`}
                          <br />
                          Sharing: {inv.invitation.sharingTypes.join(', ')}
                        </>
                      }
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton
                      color="success"
                      size="small"
                      title="Accept"
                      onClick={() => onAcceptInvitation(inv.invitation.userId)}
                    >
                      <Check fontSize="small" />
                    </IconButton>
                    <IconButton
                      color="error"
                      size="small"
                      title="Reject"
                      onClick={() => onRejectInvitation(inv.invitation.userId)}
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

      <ShareDialog
        open={shareDialogOpen}
        onClose={onShareDialogClose}
        title="Share Recipe Data"
        description="Invite users by email. Select what to share: tags, ratings, or both."
        email={shareEmail}
        onEmailChange={onShareEmailChange}
        onInvite={onInviteUser}
        inviteDisabled={!shareEmail.trim() || (!shareTags && !shareRatings)}
        sharedUsers={mappedUsers}
        onRemoveUser={onRemoveUser}
      >
        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Checkbox checked={shareTags} onChange={(e) => onShareTagsChange(e.target.checked)} />
            }
            label="Share Tags"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={shareRatings}
                onChange={(e) => onShareRatingsChange(e.target.checked)}
              />
            }
            label="Share Ratings"
          />
        </Box>
      </ShareDialog>
    </>
  );
};

export default React.memo(RecipeSharingSection);
