'use client';

import { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';

export interface StoreActionsMenuProps {
  onImport: () => void;
  onPantryCheck: () => void;
  onHistory: () => void;
  onShare: () => void;
  onRename: () => void;
  onDelete: () => void;
  canLeave?: boolean;
  onLeave?: () => void;
  loadingPantryCheck?: boolean;
}

export function StoreActionsMenu({
  onImport,
  onPantryCheck,
  onHistory,
  onShare,
  onRename,
  onDelete,
  canLeave = false,
  onLeave,
  loadingPantryCheck = false,
}: StoreActionsMenuProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handle = (cb: () => void) => () => {
    handleClose();
    cb();
  };

  return (
    <>
      <IconButton
        aria-label="Store actions"
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={handleOpen}
        size="small"
      >
        <Icon name="more_vert" size={20} />
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={handle(onImport)}>
          <ListItemIcon>
            <Icon name="event_note" size={20} color={tokens.section.plans} />
          </ListItemIcon>
          <ListItemText>Add items from meal plans</ListItemText>
        </MenuItem>

        <MenuItem onClick={handle(onPantryCheck)} disabled={loadingPantryCheck}>
          <ListItemIcon>
            {loadingPantryCheck ? (
              <CircularProgress size={16} />
            ) : (
              <Icon name="kitchen" size={20} color={tokens.section.pantry} />
            )}
          </ListItemIcon>
          <ListItemText>Pantry check</ListItemText>
        </MenuItem>

        <MenuItem onClick={handle(onHistory)}>
          <ListItemIcon>
            <Icon name="history" size={20} />
          </ListItemIcon>
          <ListItemText>Purchase history</ListItemText>
        </MenuItem>

        <MenuItem onClick={handle(onShare)}>
          <ListItemIcon>
            <Icon name="group_add" size={20} color={tokens.state.success} />
          </ListItemIcon>
          <ListItemText>Share store</ListItemText>
        </MenuItem>

        <MenuItem onClick={handle(onRename)}>
          <ListItemIcon>
            <Icon name="edit" size={20} />
          </ListItemIcon>
          <ListItemText>Rename store</ListItemText>
        </MenuItem>

        <MenuItem onClick={handle(onDelete)}>
          <ListItemIcon>
            <Icon name="delete" size={20} color={tokens.state.danger} />
          </ListItemIcon>
          <ListItemText sx={{ color: tokens.state.danger }}>Delete store</ListItemText>
        </MenuItem>

        {canLeave && onLeave && (
          <MenuItem onClick={handle(onLeave)}>
            <ListItemIcon>
              <Icon name="logout" size={20} color={tokens.state.warn} />
            </ListItemIcon>
            <ListItemText>Leave store</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
