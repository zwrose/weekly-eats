'use client';

import { Box, CircularProgress, Container } from '@mui/material';
import Header from './Header';
import BottomNav from './BottomNav';
import { useApprovalStatus } from '../lib/use-approval-status';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { isRedirecting } = useApprovalStatus();

  // Show loading state while redirecting due to approval status change
  if (isRedirecting) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <Header />
        <Container maxWidth="md">
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4, pt: { xs: 8, md: 4 } }}>
            <CircularProgress />
          </Box>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Header />
      <Box
        component="main"
        sx={{
          pt: { xs: 1.5, md: 2 },
          pb: { xs: 7, md: 2 },
          px: { xs: 1.5, md: 3 },
        }}
      >
        {children}
      </Box>
      <BottomNav />
    </Box>
  );
}
