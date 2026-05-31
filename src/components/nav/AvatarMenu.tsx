// src/components/nav/AvatarMenu.tsx
'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Box,
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
import { tokens } from '@/lib/design-tokens';
import { NavAvatar } from './NavAvatar';

export interface AvatarMenuProps {
  variant: 'menu' | 'sheet';
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  /** Required for the desktop dropdown variant. */
  anchorEl?: HTMLElement | null;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface MenuAction {
  key: string;
  label: string;
  icon: string;
  iconColor: string;
  onClick: () => void;
  /** Show only in the mobile sheet (Pantry is a top-nav section on desktop). */
  sheetOnly?: boolean;
  adminOnly?: boolean;
}

export function AvatarMenu({
  variant,
  open,
  onClose,
  isAdmin,
  anchorEl,
  name,
  email,
  image,
}: AvatarMenuProps) {
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
      iconColor: tokens.section.pantry,
      onClick: () => go('/pantry'),
      sheetOnly: true,
    },
    {
      key: 'food-items',
      label: 'Manage food items',
      icon: 'format_list_bulleted',
      iconColor: tokens.accentUtility,
      onClick: () => go('/food-items'),
    },
    {
      key: 'users',
      label: 'Manage users',
      icon: 'person',
      iconColor: tokens.accentUtility,
      onClick: () => go('/user-management'),
      adminOnly: true,
    },
  ];

  const visible = actions.filter(
    (a) => (!a.sheetOnly || variant === 'sheet') && (!a.adminOnly || isAdmin)
  );

  if (variant === 'sheet') {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        slotProps={{
          paper: {
            sx: {
              bgcolor: tokens.surface.sheet,
              borderTopLeftRadius: `${tokens.radius.sheet}px`,
              borderTopRightRadius: `${tokens.radius.sheet}px`,
              boxShadow: tokens.shadow.sheet,
            },
          },
        }}
      >
        {/* Drag handle */}
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1, pb: 0.5 }}>
          <Box
            sx={{ width: 36, height: 4, borderRadius: '2px', bgcolor: 'rgba(255,255,255,0.18)' }}
          />
        </Box>
        {/* Identity header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2.5,
            py: 1.5,
            borderBottom: `1px solid ${tokens.border.subtle}`,
          }}
        >
          <NavAvatar name={name} image={image} size={42} />
          <Box sx={{ minWidth: 0 }}>
            <Box
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
              {name || 'Account'}
            </Box>
            {email ? (
              <Box
                sx={{
                  fontSize: 12,
                  color: tokens.text.secondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {email}
              </Box>
            ) : null}
          </Box>
        </Box>
        <List sx={{ py: 1 }}>
          {visible.map((a) => (
            <ListItemButton key={a.key} onClick={a.onClick}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Icon name={a.icon} size={18} color={a.iconColor} />
              </ListItemIcon>
              <ListItemText primary={a.label} />
            </ListItemButton>
          ))}
          <Divider sx={{ my: 1 }} />
          <ListItemButton onClick={handleSignOut}>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <Icon name="logout" size={18} color={tokens.text.secondary} />
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
      {/* Identity header (non-interactive) */}
      <Box
        tabIndex={-1}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          px: 2,
          py: 1.25,
          mt: -1,
          mb: 0.5,
          borderBottom: `1px solid ${tokens.border.subtle}`,
          outline: 'none',
        }}
      >
        <NavAvatar name={name} image={image} size={36} />
        <Box sx={{ minWidth: 0 }}>
          <Box
            sx={{
              fontSize: 14,
              fontWeight: 600,
              color: tokens.text.primary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name || 'Account'}
          </Box>
          {email ? (
            <Box
              sx={{
                fontSize: 11,
                color: tokens.text.secondary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {email}
            </Box>
          ) : null}
        </Box>
      </Box>
      {visible.map((a) => (
        <MenuItem key={a.key} onClick={a.onClick}>
          <ListItemIcon>
            <Icon name={a.icon} size={18} color={a.iconColor} />
          </ListItemIcon>
          <ListItemText>{a.label}</ListItemText>
        </MenuItem>
      ))}
      <Divider />
      <MenuItem onClick={handleSignOut}>
        <ListItemIcon>
          <Icon name="logout" size={18} color={tokens.text.secondary} />
        </ListItemIcon>
        <ListItemText>Sign out</ListItemText>
      </MenuItem>
    </Menu>
  );
}
