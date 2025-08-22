"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Box, Typography, Container, Paper, ThemeProvider } from "@mui/material";
import SignInButton from "../components/SignInButton";
import { lightTheme } from "../lib/theme";

export default function Home() {
  const { data: session, status } = useSession();

  // Show loading state while session is being fetched
  if (status === "loading") {
    return (
      <ThemeProvider theme={lightTheme}>
        <Box
          sx={{
            minHeight: "100vh",
            bgcolor: "background.default",
            display: "grid",
            placeItems: "center",
            p: 4,
          }}
        >
          <Container maxWidth="sm">
            <Typography variant="h4" component="h1" sx={{ textAlign: "center", color: "text.primary", mb: 4 }}>
              Loading...
            </Typography>
          </Container>
        </Box>
      </ThemeProvider>
    );
  }

  // If user is signed in, redirect to /meal-plans
  if (session) {
    redirect("/meal-plans");
  }

  return (
    <ThemeProvider theme={lightTheme}>
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "background.default",
          display: "grid",
          placeItems: "center",
          p: 4,
        }}
      >
        <Container maxWidth="sm">
          <Paper
            elevation={3}
            sx={{
              p: 6,
              textAlign: "center",
              borderRadius: 3,
              bgcolor: "background.paper",
            }}
          >
            <Box sx={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
              <Typography variant="h3" component="h1" sx={{ color: "primary.main", fontWeight: "bold" }}>
                Weekly Eats
              </Typography>
              
              <Typography variant="h5" component="h2" sx={{ color: "text.primary", fontWeight: 500 }}>
                Coming Soon
              </Typography>
              
              <Box sx={{ textAlign: "center", maxWidth: "md" }}>
                <Typography variant="h6" sx={{ mb: 3, color: "text.primary" }}>
                  Plan your meals, make your list, and head to the store with confidence.
                </Typography>
                <Typography variant="body1" sx={{ color: "text.secondary", mb: 4 }}>
                  Sign in to get started.
                </Typography>
              </Box>

              <SignInButton />
            </Box>
          </Paper>
        </Container>
      </Box>
    </ThemeProvider>
  );
}
