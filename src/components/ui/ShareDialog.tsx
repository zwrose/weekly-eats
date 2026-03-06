'use client';

import React, { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  TextField,
  IconButton,
  Button,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { Delete } from '@mui/icons-material';
import { responsiveDialogStyle } from '@/lib/theme';
import { DialogActions, DialogTitle } from '@/components/ui';

export interface SharedUserItem {
  key: string;
  primary: string;
  secondary: string;
}

export interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  email: string;
  onEmailChange: (email: string) => void;
  onInvite: () => void;
  inviteDisabled?: boolean;
  sharedUsers: SharedUserItem[];
  onRemoveUser: (key: string) => void;
  children?: React.ReactNode;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({
  open,
  onClose,
  title,
  description,
  email,
  onEmailChange,
  onInvite,
  inviteDisabled,
  sharedUsers,
  onRemoveUser,
  children,
}) => {
  const emailRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={responsiveDialogStyle}
      TransitionProps={{
        onEntered: () => emailRef.current?.focus(),
      }}
    >
      <DialogTitle onClose={onClose}>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>

        {children}

        {/* Invite Section */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            inputRef={emailRef}
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && email.trim()) {
                onInvite();
              }
            }}
            size="small"
            fullWidth
            placeholder="user@example.com"
          />
          <Button
            variant="contained"
            onClick={onInvite}
            disabled={inviteDisabled ?? !email.trim()}
            sx={{ minWidth: 100 }}
          >
            Invite
          </Button>
        </Box>

        {/* Shared Users List */}
        {sharedUsers.length > 0 && (
          <>
            <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
              Shared With:
            </Typography>
            <List dense disablePadding>
              {sharedUsers.map((user) => (
                <ListItem key={user.key} disableGutters>
                  <IconButton
                    size="small"
                    color="error"
                    title="Remove user"
                    onClick={() => onRemoveUser(user.key)}
                    sx={{ mr: 1 }}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                  <ListItemText primary={user.primary} secondary={user.secondary} />
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions primaryButtonIndex={0} sx={{ pt: 0 }}>
        <Button onClick={onClose} sx={{ width: { xs: '100%', sm: 'auto' } }}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
};
