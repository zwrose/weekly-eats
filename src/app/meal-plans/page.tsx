"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { 
  Container, 
  Typography, 
  Box, 
  CircularProgress, 
  Paper,
  Button
} from "@mui/material";
import { CalendarMonth, Add } from "@mui/icons-material";
import AuthenticatedLayout from "../../components/AuthenticatedLayout";

export default function MealPlansPage() {
  const { status } = useSession();

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
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 4 }}>
            <CalendarMonth sx={{ fontSize: 40, color: "primary.main" }} />
            <Typography variant="h3" component="h1" color="primary.main">
              Meal Plans
            </Typography>
          </Box>

          <Paper elevation={2} sx={{ p: 4, mb: 4 }}>
            <Typography variant="h5" gutterBottom>
              Plan Your Weekly Meals
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Create and manage your weekly meal plans. Plan your breakfast, lunch, and dinner for each day of the week.
            </Typography>
            <Button 
              variant="contained" 
              startIcon={<Add />}
              sx={{ mt: 2 }}
            >
              Create New Meal Plan
            </Button>
          </Paper>

          <Paper elevation={1} sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No meal plans yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Start by creating your first weekly meal plan to organize your meals and save time.
            </Typography>
          </Paper>
        </Box>
      </Container>
    </AuthenticatedLayout>
  );
} 