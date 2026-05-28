'use client';

import { useEffect } from 'react';
import { Box, CircularProgress, Container } from '@mui/material';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { TopNav } from './nav/TopNav';
import { BottomNav } from './nav/BottomNav';
import { SectionThemeProvider } from './nav/SectionThemeProvider';
import { useApprovalStatus } from '../lib/use-approval-status';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { isRedirecting } = useApprovalStatus();
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const user = session?.user;
  const isUnapproved = !!user && !user.isApproved && !user.isAdmin;

  // Route unapproved users to the pending-approval page (previously owned by Header).
  useEffect(() => {
    if (isUnapproved && pathname !== '/pending-approval') {
      router.push('/pending-approval');
    }
  }, [isUnapproved, pathname, router]);

  // Show nav only for an authenticated, approved (or admin) user.
  const showNav = !!user && !isUnapproved;

  if (isRedirecting) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        {showNav && <TopNav />}
        <Container maxWidth="md">
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4, pt: { xs: 8, md: 4 } }}>
            <CircularProgress />
          </Box>
        </Container>
        {showNav && <BottomNav />}
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {showNav && <TopNav />}
      <Box
        component="main"
        sx={{
          pt: { xs: 2, md: 3 },
          pb: { xs: 10, md: 3 },
        }}
      >
        <SectionThemeProvider>{children}</SectionThemeProvider>
      </Box>
      {showNav && <BottomNav />}
    </Box>
  );
}
