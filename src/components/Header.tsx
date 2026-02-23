'use client';

import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Menu,
  MenuItem,
  Button,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  IconButton,
} from '@mui/material';
import { CachedAvatar } from './CachedAvatar';
import {
  Settings,
  Logout,
  Person,
  FormatListBulleted,
  Kitchen,
} from '@mui/icons-material';
import SessionWrapper from './SessionWrapper';
import { useRouter, usePathname } from 'next/navigation';

export default function Header() {
  const { data: session } = useSession();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    // Redirect unapproved users to pending approval page
    if (session?.user && !session.user.isApproved && !session.user.isAdmin) {
      router.push('/pending-approval');
    }
  }, [session, router]);

  const handleMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleSignOut = useCallback(() => {
    signOut({ callbackUrl: '/' });
    setAnchorEl(null);
  }, []);

  const handleSettings = useCallback(() => {
    router.push('/settings');
    setAnchorEl(null);
  }, [router]);

  const handleAdmin = useCallback(() => {
    router.push('/user-management');
    setAnchorEl(null);
  }, [router]);

  const handleFoodItems = useCallback(() => {
    router.push('/food-items');
    setAnchorEl(null);
  }, [router]);

  const handlePantry = useCallback(() => {
    router.push('/pantry');
    setAnchorEl(null);
  }, [router]);

  const handleNavMealPlans = useCallback(() => {
    router.push('/meal-plans');
  }, [router]);

  const handleNavShoppingLists = useCallback(() => {
    router.push('/shopping-lists');
  }, [router]);

  const handleNavRecipes = useCallback(() => {
    router.push('/recipes');
  }, [router]);

  const handleNavPantry = useCallback(() => {
    router.push('/pantry');
  }, [router]);

  // Check if we should hide the header for unapproved users
  const shouldHideHeader = session?.user && !session.user.isApproved && !session.user.isAdmin;

  return (
    <SessionWrapper>
      {session?.user && !shouldHideHeader && (
        <AppBar
          position="sticky"
          color="default"
          elevation={0}
          sx={{ display: { xs: 'none', md: 'block' } }}
        >
          <Toolbar sx={{ minHeight: '48px !important' }}>
            <Typography
              component="div"
              sx={{
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                userSelect: 'none',
                color: 'text.primary',
                mr: 2,
              }}
              onClick={handleNavMealPlans}
            >
              Weekly Eats
            </Typography>

            {/* Desktop Navigation */}
            <Box
              sx={{
                display: { xs: 'none', md: 'flex' },
                gap: 1,
                flexGrow: 1,
              }}
            >
              <Button
                onClick={handleNavMealPlans}
                sx={{
                  textTransform: 'none',
                  color: 'text.primary',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  borderBottom: pathname === '/meal-plans' ? '2px solid #5b9bd5' : '2px solid transparent',
                  borderRadius: 0,
                  px: 1.5,
                  py: 0.75,
                  minHeight: 'auto',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.04)',
                  },
                }}
              >
                Meal Plans
              </Button>
              <Button
                onClick={handleNavShoppingLists}
                sx={{
                  textTransform: 'none',
                  color: 'text.primary',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  borderBottom: pathname === '/shopping-lists' ? '2px solid #6baf7b' : '2px solid transparent',
                  borderRadius: 0,
                  px: 1.5,
                  py: 0.75,
                  minHeight: 'auto',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.04)',
                  },
                }}
              >
                Shopping Lists
              </Button>
              <Button
                onClick={handleNavRecipes}
                sx={{
                  textTransform: 'none',
                  color: 'text.primary',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  borderBottom: pathname === '/recipes' ? '2px solid #d4915e' : '2px solid transparent',
                  borderRadius: 0,
                  px: 1.5,
                  py: 0.75,
                  minHeight: 'auto',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.04)',
                  },
                }}
              >
                Recipes
              </Button>
              <Button
                onClick={handleNavPantry}
                sx={{
                  textTransform: 'none',
                  color: 'text.primary',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  borderBottom: pathname === '/pantry' ? '2px solid #a87bb5' : '2px solid transparent',
                  borderRadius: 0,
                  px: 1.5,
                  py: 0.75,
                  minHeight: 'auto',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.04)',
                  },
                }}
              >
                Pantry
              </Button>
            </Box>

            {/* Desktop user menu - hidden on mobile where bottom nav is used */}
            <IconButton
              onClick={handleMenu}
              sx={{
                display: { xs: 'none', md: 'flex' },
                p: 0.5,
              }}
            >
              <CachedAvatar
                src={session.user.image}
                alt={session.user.name || 'Profile'}
                sx={{ width: 28, height: 28 }}
              />
            </IconButton>

            {/* Desktop User Menu */}
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorEl)}
              onClose={handleClose}
            >
              <MenuItem disabled sx={{ opacity: '1 !important' }}>
                <ListItemText
                  primary={session.user.name}
                  primaryTypographyProps={{
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    color: 'text.primary',
                  }}
                />
              </MenuItem>
              <Divider />
              <MenuItem onClick={handlePantry}>
                <ListItemIcon>
                  <Kitchen fontSize="small" />
                </ListItemIcon>
                <ListItemText>Pantry</ListItemText>
              </MenuItem>
              <MenuItem onClick={handleFoodItems}>
                <ListItemIcon>
                  <FormatListBulleted fontSize="small" />
                </ListItemIcon>
                <ListItemText>Manage Food Items</ListItemText>
              </MenuItem>
              {session.user.isAdmin && (
                <MenuItem onClick={handleAdmin}>
                  <ListItemIcon>
                    <Person fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Manage Users</ListItemText>
                </MenuItem>
              )}
              <MenuItem onClick={handleSettings}>
                <ListItemIcon>
                  <Settings fontSize="small" />
                </ListItemIcon>
                <ListItemText>Settings</ListItemText>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleSignOut}>
                <ListItemIcon>
                  <Logout fontSize="small" />
                </ListItemIcon>
                <ListItemText>Sign Out</ListItemText>
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>
      )}
    </SessionWrapper>
  );
}
