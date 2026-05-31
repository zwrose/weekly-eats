'use client';

import { signIn } from 'next-auth/react';
import { Button } from '@mui/material';
import { useSearchParams } from 'next/navigation';
import { GoogleIcon, GOOGLE_BUTTON_SX } from './GoogleIcon';

export default function SignInButton() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/meal-plans';

  return (
    <Button
      variant="contained"
      size="large"
      onClick={() => signIn('google', { redirectTo: callbackUrl })}
      sx={GOOGLE_BUTTON_SX}
      startIcon={<GoogleIcon />}
    >
      Sign in with Google
    </Button>
  );
}
