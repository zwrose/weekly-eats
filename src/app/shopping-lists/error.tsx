"use client";

import { Container, Box, Typography, Button, Alert } from "@mui/material";

export default function ShoppingListsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4, textAlign: "center" }}>
        <Alert severity="error" sx={{ mb: 3, textAlign: "left" }}>
          <Typography variant="body1">
            {error.message || "An unexpected error occurred while loading shopping lists."}
          </Typography>
        </Alert>
        <Button variant="contained" onClick={reset}>
          Try Again
        </Button>
      </Box>
    </Container>
  );
}
