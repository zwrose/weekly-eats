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
  AdminPanelSettings
} from "@mui/icons-material";
import SessionWrapper from "./SessionWrapper";
import { useRouter } from "next/navigation";

export default function Header() {
  const { data: session } = useSession();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const router = useRouter();
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

  const handleHomeClick = () => {
    router.push('/home');
  };

  const handleAdmin = () => {
    router.push('/admin');
    handleClose();
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
            <Box 
              sx={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 1.5,
                flexGrow: 1,
                cursor: "pointer",
                userSelect: "none",
              }}
              onClick={handleHomeClick}
            >
              <Image
                src="/icon0.svg"
                alt="Weekly Eats"
                width={32}
                height={32}
                style={{ minWidth: 32, display: 'block' }}
                priority
              />
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
              <Typography variant="body1" color="text.secondary">
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
              <MenuItem onClick={handleSettings}>
                <ListItemIcon>
                  <Settings fontSize="small" />
                </ListItemIcon>
                <ListItemText>Settings</ListItemText>
              </MenuItem>
              {(session.user as { isAdmin?: boolean }).isAdmin && (
                <MenuItem onClick={handleAdmin}>
                  <ListItemIcon>
                    <AdminPanelSettings fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Admin</ListItemText>
                </MenuItem>
              )}
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