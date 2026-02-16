"use client";

import React, { useRef } from "react";
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  TextField,
  IconButton,
  Divider,
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import {
  Check,
  Close as CloseIcon,
  PersonAdd,
  Delete,
} from "@mui/icons-material";
import { responsiveDialogStyle } from "@/lib/theme";
import { DialogActions, DialogTitle } from "@/components/ui";
import { PendingRecipeInvitation, SharedUser } from "@/lib/recipe-sharing-utils";

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
  const shareEmailRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {/* Pending Recipe Sharing Invitations */}
      {pendingInvitations && pendingInvitations.length > 0 && (
        <Paper sx={{ p: 3, mb: 4, maxWidth: "md", mx: "auto" }}>
          <Typography
            variant="h6"
            gutterBottom
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            <PersonAdd />
            Pending Recipe Sharing Invitations (
            {pendingInvitations?.length || 0})
          </Typography>
          <List>
            {pendingInvitations?.map((inv) => (
              <Box key={inv.ownerId}>
                <ListItem>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
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
                          Sharing: {inv.invitation.sharingTypes.join(", ")}
                        </>
                      }
                    />
                  </Box>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <IconButton
                      color="success"
                      size="small"
                      title="Accept"
                      onClick={() =>
                        onAcceptInvitation(inv.invitation.userId)
                      }
                    >
                      <Check fontSize="small" />
                    </IconButton>
                    <IconButton
                      color="error"
                      size="small"
                      title="Reject"
                      onClick={() =>
                        onRejectInvitation(inv.invitation.userId)
                      }
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

      {/* Share Recipe Data Dialog */}
      <Dialog
        open={shareDialogOpen}
        onClose={onShareDialogClose}
        maxWidth="sm"
        fullWidth
        sx={responsiveDialogStyle}
        TransitionProps={{
          onEntered: () => shareEmailRef.current?.focus(),
        }}
      >
        <DialogTitle onClose={onShareDialogClose}>
          Share Recipe Data
        </DialogTitle>
        <DialogContent>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 2 }}
          >
            Invite users by email. Select what to share: tags, ratings, or
            both.
          </Typography>

          {/* Sharing Type Selection */}
          <Box sx={{ mb: 3 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={shareTags}
                  onChange={(e) => onShareTagsChange(e.target.checked)}
                />
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

          {/* Invite Section */}
          <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
            <TextField
              inputRef={shareEmailRef}
              label="Email Address"
              type="email"
              value={shareEmail}
              onChange={(e) => onShareEmailChange(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter" && shareEmail.trim()) {
                  onInviteUser();
                }
              }}
              size="small"
              fullWidth
              placeholder="user@example.com"
            />
            <Button
              variant="contained"
              onClick={onInviteUser}
              disabled={!shareEmail.trim() || (!shareTags && !shareRatings)}
              sx={{ minWidth: 100 }}
            >
              Invite
            </Button>
          </Box>

          {/* Shared Users List */}
          {sharedUsers && sharedUsers.length > 0 && (
            <>
              <Typography
                variant="subtitle2"
                gutterBottom
                sx={{ mt: 3 }}
              >
                Shared With:
              </Typography>
              <List>
                {sharedUsers.map((user) => (
                  <ListItem key={user.userId}>
                    <ListItemText
                      primary={user.name || user.email}
                      secondary={`${user.email} - Sharing: ${user.sharingTypes.join(", ")}`}
                    />
                    <IconButton
                      size="small"
                      color="error"
                      title="Remove user"
                      onClick={() => onRemoveUser(user.userId)}
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
              onClick={onShareDialogClose}
              sx={{ width: { xs: "100%", sm: "auto" } }}
            >
              Done
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RecipeSharingSection;
