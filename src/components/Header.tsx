"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  AppBar,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Button,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
} from "@mui/material";
import { 
  AccountCircle, 
  Settings,
  Logout,
  Person,
  FormatListBulleted,
  CalendarMonth,
  ShoppingCart,
  Restaurant,
  Kitchen,
  Menu as MenuIcon
} from "@mui/icons-material";
import SessionWrapper from "./SessionWrapper";
import { useRouter, usePathname } from "next/navigation";

export default function Header() {
  const { data: session } = useSession();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileMenuAnchorEl, setMobileMenuAnchorEl] = useState<null | HTMLElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const sessionRef = useRef(session);

  // Update ref when session changes
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    // Redirect unapproved users to pending approval page
    if (session?.user && !(session.user as { isApproved?: boolean }).isApproved && 
        !(session.user as { isAdmin?: boolean }).isAdmin) {
      router.push('/pending-approval');
    }
  }, [session, router]);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" });
    handleClose();
  };

  const handleSettings = () => {
    router.push('/settings');
    handleClose();
  };

  const handleAdmin = () => {
    router.push('/user-management');
    handleClose();
  };

  const handleFoodItems = () => {
    router.push('/food-items');
    handleClose();
  };

  const handleMobileMenu = (event: React.MouseEvent<HTMLElement>) => {
    setMobileMenuAnchorEl(event.currentTarget);
  };

  const handleMobileMenuClose = () => {
    setMobileMenuAnchorEl(null);
  };

  const handleNavigation = (path: string) => {
    router.push(path);
    handleMobileMenuClose();
  };

  // Check if we should hide the header for unapproved users
  const shouldHideHeader = session?.user && 
    !(session.user as { isApproved?: boolean }).isApproved && 
    !(session.user as { isAdmin?: boolean }).isAdmin;

  return (
    <SessionWrapper>
      {session?.user && !shouldHideHeader && (
        <AppBar position="sticky" color="default" elevation={1}>
          <Toolbar>
            {/* Mobile Menu Button - Left Side */}
            <Box sx={{ display: { xs: 'flex', md: 'none' }, mr: 2 }}>
              <Button
                onClick={handleMobileMenu}
                sx={{ 
                  minWidth: 'auto', 
                  p: 1,
                  color: 'white'
                }}
              >
                <MenuIcon />
              </Button>
            </Box>

            <Box 
              sx={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 1.5,
                cursor: "pointer",
                userSelect: "none",
                flexGrow: 1,
              }}
              onClick={() => router.push('/meal-plans')}
            >
              <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                <Image
                  src="/icon0.svg"
                  alt="Weekly Eats"
                  width={32}
                  height={32}
                  style={{ minWidth: 32, display: 'block' }}
                  priority
                />
              </Box>
              <Typography 
                variant="h4" 
                component="div" 
                sx={{ 
                  fontWeight: "bold",
                }}
              >
                Weekly Eats
              </Typography>
            </Box>

            {/* Desktop Navigation */}
            <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 2, ml: 4, flexGrow: 1 }}>
              <Button
                onClick={() => router.push('/meal-plans')}
                startIcon={<CalendarMonth sx={{ color: 'white' }} />}
                sx={{ 
                  textTransform: 'none',
                  color: 'white',
                  fontSize: '1.1rem',
                  fontWeight: 'medium',
                  borderBottom: pathname === '/meal-plans' ? '3px solid #1976d2' : 'none',
                  borderRadius: 0,
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderBottom: '3px solid #1976d2'
                  }
                }}
              >
                Meal Plans
              </Button>
              <Button
                onClick={() => router.push('/shopping-lists')}
                startIcon={<ShoppingCart sx={{ color: 'white' }} />}
                sx={{ 
                  textTransform: 'none',
                  color: 'white',
                  fontSize: '1.1rem',
                  fontWeight: 'medium',
                  borderBottom: pathname === '/shopping-lists' ? '3px solid #2e7d32' : 'none',
                  borderRadius: 0,
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderBottom: '3px solid #2e7d32'
                  }
                }}
              >
                Shopping Lists
              </Button>
              <Button
                onClick={() => router.push('/recipes')}
                startIcon={<Restaurant sx={{ color: 'white' }} />}
                sx={{ 
                  textTransform: 'none',
                  color: 'white',
                  fontSize: '1.1rem',
                  fontWeight: 'medium',
                  borderBottom: pathname === '/recipes' ? '3px solid #ed6c02' : 'none',
                  borderRadius: 0,
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderBottom: '3px solid #ed6c02'
                  }
                }}
              >
                Recipes
              </Button>
              <Button
                onClick={() => router.push('/pantry')}
                startIcon={<Kitchen sx={{ color: 'white' }} />}
                sx={{ 
                  textTransform: 'none',
                  color: 'white',
                  fontSize: '1.1rem',
                  fontWeight: 'medium',
                  borderBottom: pathname === '/pantry' ? '3px solid #9c27b0' : 'none',
                  borderRadius: 0,
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderBottom: '3px solid #9c27b0'
                  }
                }}
              >
                Pantry
              </Button>
            </Box>
            
            <Button
              onClick={handleMenu}
              sx={{
                textTransform: "none",
                color: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 2,
                py: 1,
                borderRadius: 2,
                "&:hover": {
                  backgroundColor: "rgba(0, 0, 0, 0.04)",
                },
              }}
            >
              {session.user.image ? (
                <Avatar
                  src={session.user.image}
                  alt={session.user.name || "Profile"}
                  sx={{ width: 32, height: 32 }}
                />
              ) : (
                <AccountCircle sx={{ width: 32, height: 32 }} />
              )}
              <Typography variant="body1" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                {session.user.name}
              </Typography>
            </Button>
            
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
              }}
              keepMounted
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              open={Boolean(anchorEl)}
              onClose={handleClose}
            >
              <MenuItem onClick={handleFoodItems}>
                <ListItemIcon>
                  <FormatListBulleted fontSize="small" />
                </ListItemIcon>
                <ListItemText>Manage Food Items</ListItemText>
              </MenuItem>
              {(session.user as { isAdmin?: boolean }).isAdmin && (
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

            {/* Mobile Navigation Menu */}
            <Menu
              id="mobile-menu"
              anchorEl={mobileMenuAnchorEl}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
              }}
              keepMounted
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              open={Boolean(mobileMenuAnchorEl)}
              onClose={handleMobileMenuClose}
            >
              <MenuItem onClick={() => handleNavigation('/meal-plans')}>
                <ListItemIcon>
                  <CalendarMonth fontSize="small" />
                </ListItemIcon>
                <ListItemText>Meal Plans</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => handleNavigation('/shopping-lists')}>
                <ListItemIcon>
                  <ShoppingCart fontSize="small" />
                </ListItemIcon>
                <ListItemText>Shopping Lists</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => handleNavigation('/recipes')}>
                <ListItemIcon>
                  <Restaurant fontSize="small" />
                </ListItemIcon>
                <ListItemText>Recipes</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => handleNavigation('/pantry')}>
                <ListItemIcon>
                  <Kitchen fontSize="small" />
                </ListItemIcon>
                <ListItemText>Pantry</ListItemText>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleFoodItems}>
                <ListItemIcon>
                  <FormatListBulleted fontSize="small" />
                </ListItemIcon>
                <ListItemText>Manage Food Items</ListItemText>
              </MenuItem>
              {(session.user as { isAdmin?: boolean }).isAdmin && (
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