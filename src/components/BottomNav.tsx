"use client";

import { useState, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import {
  Paper,
  BottomNavigation,
  BottomNavigationAction,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from "@mui/material";
import { CachedAvatar } from "./CachedAvatar";
import {
  CalendarMonth,
  ShoppingCart,
  Restaurant,
  Kitchen,
  FormatListBulleted,
  Settings,
  Logout,
  Person,
} from "@mui/icons-material";
import SessionWrapper from "./SessionWrapper";

export default function BottomNav() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleProfileMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleSignOut = useCallback(() => {
    signOut({ callbackUrl: "/" });
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

  // Determine current value based on pathname
  const getCurrentValue = () => {
    if (pathname === '/meal-plans') return 0;
    if (pathname === '/shopping-lists') return 1;
    if (pathname === '/recipes') return 2;
    return 3; // profile
  };

  // Check if we should hide the bottom nav for unapproved users
  const shouldHideBottomNav = session?.user && 
    !session.user.isApproved && 
    !session.user.isAdmin;

  if (!session?.user || shouldHideBottomNav) {
    return null;
  }

  return (
    <SessionWrapper>
      <Paper
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          display: { xs: 'block', md: 'none' },
          zIndex: 1100,
        }}
        elevation={3}
      >
        <BottomNavigation
          value={getCurrentValue()}
          showLabels={false}
          sx={{
            height: 70,
            '& .MuiBottomNavigationAction-root': {
              minWidth: 'auto',
              padding: '6px 12px 8px',
            },
          }}
        >
          <BottomNavigationAction
            aria-label="Meal Plans"
            icon={<CalendarMonth />}
            onClick={handleNavMealPlans}
            sx={{
              '&.Mui-selected': {
                color: '#1976d2',
              },
            }}
          />
          <BottomNavigationAction
            aria-label="Shopping Lists"
            icon={<ShoppingCart />}
            onClick={handleNavShoppingLists}
            sx={{
              '&.Mui-selected': {
                color: '#2e7d32',
              },
            }}
          />
          <BottomNavigationAction
            aria-label="Recipes"
            icon={<Restaurant />}
            onClick={handleNavRecipes}
            sx={{
              '&.Mui-selected': {
                color: '#ed6c02',
              },
            }}
          />
          <BottomNavigationAction
            aria-label="Profile"
            icon={
              <CachedAvatar
                  src={session.user.image}
                  alt={session.user.name || "Profile"}
                  sx={{ width: 24, height: 24 }}
                />
            }
            onClick={handleProfileMenu}
          />
        </BottomNavigation>

        <Menu
          id="profile-menu-bottom"
          anchorEl={anchorEl}
          anchorOrigin={{
            vertical: "top",
            horizontal: "right",
          }}
          keepMounted
          transformOrigin={{
            vertical: "bottom",
            horizontal: "right",
          }}
          open={Boolean(anchorEl)}
          onClose={handleClose}
        >
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
      </Paper>
    </SessionWrapper>
  );
}

