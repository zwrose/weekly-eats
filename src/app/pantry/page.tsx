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
import { Kitchen, Add } from "@mui/icons-material";
import AuthenticatedLayout from "../../components/AuthenticatedLayout";

export default function PantryPage() {
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
            <Kitchen sx={{ fontSize: 40, color: "#9c27b0" }} />
            <Typography variant="h3" component="h1" sx={{ color: "#9c27b0" }}>
              Pantry
            </Typography>
          </Box>

          <Paper elevation={2} sx={{ p: 4, mb: 4 }}>
            <Typography variant="h5" gutterBottom>
              Track Your Pantry Items
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Keep track of what&apos;s in your pantry. Monitor expiration dates, track quantities, and never run out of essential ingredients.
            </Typography>
            <Button 
              variant="contained" 
              startIcon={<Add />}
              sx={{ mt: 2, bgcolor: "#9c27b0", "&:hover": { bgcolor: "#7b1fa2" } }}
            >
              Add Pantry Item
            </Button>
          </Paper>

          <Paper elevation={1} sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No pantry items yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Start by adding items to your pantry to keep track of your ingredients.
            </Typography>
          </Paper>
        </Box>
      </Container>
    </AuthenticatedLayout>
  );
} 