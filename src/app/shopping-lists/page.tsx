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
import { ShoppingCart, Add } from "@mui/icons-material";
import AuthenticatedLayout from "../../components/AuthenticatedLayout";

export default function ShoppingListsPage() {
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
            <ShoppingCart sx={{ fontSize: 40, color: "#2e7d32" }} />
            <Typography variant="h3" component="h1" sx={{ color: "#2e7d32" }}>
              Shopping Lists
            </Typography>
          </Box>

          <Paper elevation={2} sx={{ p: 4, mb: 4 }}>
            <Typography variant="h5" gutterBottom>
              Manage Your Grocery Lists
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Create and organize your shopping lists. Add items, check them off as you shop, and never forget an ingredient again.
            </Typography>
            <Button 
              variant="contained" 
              startIcon={<Add />}
              sx={{ mt: 2, bgcolor: "#2e7d32", "&:hover": { bgcolor: "#1b5e20" } }}
            >
              Create New List
            </Button>
          </Paper>

          <Paper elevation={1} sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No shopping lists yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Start by creating your first shopping list to organize your grocery shopping.
            </Typography>
          </Paper>
        </Box>
      </Container>
    </AuthenticatedLayout>
  );
} 