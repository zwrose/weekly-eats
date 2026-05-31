'use client';

import { signIn } from 'next-auth/react';
import { Button } from '@mui/material';
import { useSearchParams } from 'next/navigation';
import { GoogleIcon } from './GoogleIcon';

export default function SignInButton() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/meal-plans';

  return (
    <Button
      variant="contained"
      color="inherit"
      size="large"
      onClick={() => signIn('google', { redirectTo: callbackUrl })}
      sx={{
        textTransform: 'none',
        bgcolor: 'background.paper',
        color: 'text.primary',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        '&:hover': {
          bgcolor: 'grey.100',
        },
      }}
      startIcon={<GoogleIcon />}
    >
      Sign in with Google
    </Button>
  );
}
