"use client";

import { Box, CircularProgress, Container } from "@mui/material";
import Header from "./Header";
import BottomNav from "./BottomNav";
import { useApprovalStatus } from "../lib/use-approval-status";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isRedirecting } = useApprovalStatus();

  // Show loading state while redirecting due to approval status change
  if (isRedirecting) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
        <Header />
        <Container maxWidth="md">
          <Box sx={{ display: "flex", justifyContent: "center", py: 4, pt: { xs: 8, md: 4 } }}>
            <CircularProgress />
          </Box>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Header />
      <Box 
        component="main" 
        sx={{ 
          pt: { xs: 2, md: 3 }, // Top padding on mobile matches side padding
          pb: { xs: 10, md: 3 } // Extra padding on mobile to account for bottom nav
        }}
      >
        {children}
      </Box>
      <BottomNav />
    </Box>
  );
} 