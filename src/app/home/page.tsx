"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Container, Typography, Box, CircularProgress, Paper } from "@mui/material";
import AuthenticatedLayout from "../../components/AuthenticatedLayout";

export default function HomePage() {
  const { data: session, status } = useSession();

  // Show loading state while session is being fetched
  if (status === "loading") {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="md">
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      </AuthenticatedLayout>
    );
  }

  // Only redirect if session is definitely not available
  if (status === "unauthenticated") {
    redirect("/");
  }

  return (
    <AuthenticatedLayout>
      <Container maxWidth="md">
        <Paper
          elevation={2}
          sx={{
            p: 6,
            textAlign: "center",
            borderRadius: 3,
            bgcolor: "background.paper",
          }}
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Typography variant="h3" component="h1" color="primary.main" gutterBottom>
              Welcome to Weekly Eats
            </Typography>
            <Typography variant="h6" color="text.primary" sx={{ mb: 2 }}>
              Hello, {session?.user?.name || "User"}! Your meal planning journey starts here.
            </Typography>
            <Typography variant="body1" color="text.secondary">
              More features coming soon...
            </Typography>
          </Box>
        </Paper>
      </Container>
    </AuthenticatedLayout>
  );
} 