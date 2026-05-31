'use client';

import { Container, Box, Typography, Button, Alert } from '@mui/material';
import { tokens } from '@/lib/design-tokens';

export default function MealPlansError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Alert
          severity="error"
          sx={{
            mb: 3,
            textAlign: 'left',
            bgcolor: tokens.state.dangerMuted,
            color: tokens.text.primary,
            border: `1px solid ${tokens.state.danger}`,
            '& .MuiAlert-icon': { color: tokens.state.danger },
          }}
        >
          <Typography variant="body1" sx={{ color: tokens.text.primary }}>
            {error.message || 'An unexpected error occurred while loading meal plans.'}
          </Typography>
        </Alert>
        <Button variant="contained" onClick={reset}>
          Try Again
        </Button>
      </Box>
    </Container>
  );
}
