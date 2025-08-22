"use client";

import { useSession, signOut } from 'next-auth/react';
import { 
  Container, 
  Typography, 
  Box, 
  Paper, 
  Button,
  CircularProgress,
  Alert
} from '@mui/material';
import { 
  HourglassEmpty,
  Logout
} from '@mui/icons-material';
import AuthenticatedLayout from '../../components/AuthenticatedLayout';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PendingApprovalPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Handle redirects based on authentication and approval status
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push('/');
    } else if (status === "authenticated" && (session?.user as { isApproved?: boolean })?.isApproved) {
              router.push('/meal-plans');
    }
  }, [status, session, router]);

  // Show loading state while session is being fetched
  if (status === "loading") {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="md" sx={{ py: 4 }}>
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      </AuthenticatedLayout>
    );
  }

  // Show loading while redirecting
  if (status === "unauthenticated" || 
      (status === "authenticated" && (session?.user as { isApproved?: boolean })?.isApproved)) {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="md" sx={{ py: 4 }}>
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      </AuthenticatedLayout>
    );
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" });
  };

  return (
    <AuthenticatedLayout>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <HourglassEmpty sx={{ fontSize: 80, color: 'text.secondary', mb: 3 }} />
          
          <Typography variant="h4" component="h1" gutterBottom>
            Account Pending Approval
          </Typography>
          
          <Paper sx={{ p: 4, mt: 4, maxWidth: 600, mx: 'auto' }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              Welcome to Weekly Eats, {session?.user?.name}!
            </Alert>
            
            <Typography variant="h6" gutterBottom>
              Your account is currently under review
            </Typography>
            
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Thank you for signing up! Your account has been created and is now pending approval by an administrator. 
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<Logout />}
                onClick={handleSignOut}
              >
                Sign Out
              </Button>
            </Box>
          </Paper>
        </Box>
      </Container>
    </AuthenticatedLayout>
  );
} 