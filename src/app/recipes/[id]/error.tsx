'use client';
import { Alert, Box, Button, Container } from '@mui/material';

export default function RecipeDetailError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Alert severity="error" sx={{ mb: 2 }}>
        {error.message || 'Failed to load recipe'}
      </Alert>
      <Box>
        <Button variant="contained" onClick={reset}>
          Try Again
        </Button>
      </Box>
    </Container>
  );
}
