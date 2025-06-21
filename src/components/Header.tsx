"use client";

import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
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
  Logout 
} from "@mui/icons-material";
import SessionWrapper from "./SessionWrapper";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function Header() {
  const { data: session } = useSession();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const router = useRouter();

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

  return (
    <SessionWrapper>
      {session?.user && (
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
                style={{ minWidth: 32 }}
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