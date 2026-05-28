// src/components/nav/AvatarMenu.tsx
'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Menu,
  MenuItem,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import { Icon } from '@/components/ui/Icon';

export interface AvatarMenuProps {
  variant: 'menu' | 'sheet';
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  /** Required for the desktop dropdown variant. */
  anchorEl?: HTMLElement | null;
}

interface MenuAction {
  key: string;
  label: string;
  icon: string;
  onClick: () => void;
  /** Show only in the mobile sheet (Pantry is a top-nav section on desktop). */
  sheetOnly?: boolean;
  adminOnly?: boolean;
}

export function AvatarMenu({ variant, open, onClose, isAdmin, anchorEl }: AvatarMenuProps) {
  const router = useRouter();

  const go = useCallback(
    (href: string) => {
      router.push(href);
      onClose();
    },
    [router, onClose]
  );

  const handleSignOut = useCallback(() => {
    signOut({ callbackUrl: '/' });
    onClose();
  }, [onClose]);

  const actions: MenuAction[] = [
    {
      key: 'pantry',
      label: 'Pantry',
      icon: 'kitchen',
      onClick: () => go('/pantry'),
      sheetOnly: true,
    },
    {
      key: 'food-items',
      label: 'Manage food items',
      icon: 'format_list_bulleted',
      onClick: () => go('/food-items'),
    },
    {
      key: 'users',
      label: 'Manage users',
      icon: 'person',
      onClick: () => go('/user-management'),
      adminOnly: true,
    },
  ];

  const visible = actions.filter(
    (a) => (!a.sheetOnly || variant === 'sheet') && (!a.adminOnly || isAdmin)
  );

  if (variant === 'sheet') {
    return (
      <Drawer anchor="bottom" open={open} onClose={onClose}>
        <List sx={{ py: 1 }}>
          {visible.map((a) => (
            <ListItemButton key={a.key} onClick={a.onClick}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Icon name={a.icon} size={22} />
              </ListItemIcon>
              <ListItemText primary={a.label} />
            </ListItemButton>
          ))}
          <Divider sx={{ my: 1 }} />
          <ListItemButton onClick={handleSignOut}>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <Icon name="logout" size={22} />
            </ListItemIcon>
            <ListItemText primary="Sign out" />
          </ListItemButton>
        </List>
      </Drawer>
    );
  }

  return (
    <Menu
      anchorEl={anchorEl ?? null}
      open={open}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      keepMounted
    >
      {visible.map((a) => (
        <MenuItem key={a.key} onClick={a.onClick}>
          <ListItemIcon>
            <Icon name={a.icon} size={20} />
          </ListItemIcon>
          <ListItemText>{a.label}</ListItemText>
        </MenuItem>
      ))}
      <Divider />
      <MenuItem onClick={handleSignOut}>
        <ListItemIcon>
          <Icon name="logout" size={20} />
        </ListItemIcon>
        <ListItemText>Sign out</ListItemText>
      </MenuItem>
    </Menu>
  );
}
