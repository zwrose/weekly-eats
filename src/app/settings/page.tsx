'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Container, Typography, Box, Paper, CircularProgress } from '@mui/material';
import AuthenticatedLayout from '../../components/AuthenticatedLayout';

export default function SettingsPage() {
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="xl" sx={{ py: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      </AuthenticatedLayout>
    );
  }

  if (status === 'unauthenticated') {
    redirect('/');
  }

  return (
    <AuthenticatedLayout>
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Paper elevation={0} sx={{ p: 6, borderRadius: 3, textAlign: 'center' }}>
          <Typography variant="h4" component="h1" color="primary.main" gutterBottom>
            Settings
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Nothing to settle right now — light mode will return.
          </Typography>
        </Paper>
      </Container>
    </AuthenticatedLayout>
  );
}
