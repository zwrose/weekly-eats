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
import { Restaurant, Add } from "@mui/icons-material";
import AuthenticatedLayout from "../../components/AuthenticatedLayout";

export default function RecipesPage() {
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
            <Restaurant sx={{ fontSize: 40, color: "#ed6c02" }} />
            <Typography variant="h3" component="h1" sx={{ color: "#ed6c02" }}>
              Recipes
            </Typography>
          </Box>

          <Paper elevation={2} sx={{ p: 4, mb: 4 }}>
            <Typography variant="h5" gutterBottom>
              Save and Organize Your Recipes
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Build your personal recipe collection. Save your favorite recipes, organize them by category, and access them anytime.
            </Typography>
            <Button 
              variant="contained" 
              startIcon={<Add />}
              sx={{ mt: 2, bgcolor: "#ed6c02", "&:hover": { bgcolor: "#e65100" } }}
            >
              Add New Recipe
            </Button>
          </Paper>

          <Paper elevation={1} sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No recipes yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Start by adding your first recipe to build your personal cookbook.
            </Typography>
          </Paper>
        </Box>
      </Container>
    </AuthenticatedLayout>
  );
} 