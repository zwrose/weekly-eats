import { Box, Button, Container, Paper, Typography } from '@mui/material';
import { signIn } from '@/lib/auth';
import { peekAuthState } from '@/lib/mcp/oauth/stores/auth-states';
import { getClient } from '@/lib/mcp/oauth/stores/clients';
import { GoogleIcon } from '@/components/GoogleIcon';

// Server action: kick off Google sign-in, returning to the authorize
// continuation (which re-enters /authorize with the same single-use nonce).
async function startGoogleSignIn(formData: FormData) {
  'use server';
  const value = formData.get('mcp_auth');
  const redirectTo =
    typeof value === 'string' && value
      ? `/api/mcp/oauth/authorize?mcp_auth=${encodeURIComponent(value)}`
      : '/meal-plans';
  await signIn('google', { redirectTo });
}

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { mcp_auth } = await searchParams;
  const nonce = typeof mcp_auth === 'string' ? mcp_auth : '';

  const state = nonce ? await peekAuthState(nonce, Date.now()) : null;
  if (!state) {
    return (
      <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 8 } }}>
        <Paper sx={{ p: { xs: 3, sm: 4 } }} elevation={2}>
          <Typography variant="h5" component="h1" gutterBottom>
            Connection link expired
          </Typography>
          <Typography variant="body1" color="text.secondary">
            This connection link has expired or is invalid. Start the connection again from your
            agent to continue.
          </Typography>
        </Paper>
      </Container>
    );
  }

  const client = await getClient(state.clientId);
  const clientName = client?.clientName?.trim();
  const title = clientName ? `Connect ${clientName} to Weekly Eats` : 'Connect to Weekly Eats';

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 8 } }}>
      <Paper sx={{ p: { xs: 3, sm: 4 } }} elevation={2}>
        <Typography variant="h5" component="h1" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Sign in to continue connecting your Weekly Eats account.
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <form action={startGoogleSignIn}>
            <input type="hidden" name="mcp_auth" value={nonce} />
            <Button
              type="submit"
              variant="contained"
              color="inherit"
              size="large"
              startIcon={<GoogleIcon />}
              sx={{
                textTransform: 'none',
                bgcolor: 'background.paper',
                color: 'text.primary',
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                '&:hover': { bgcolor: 'grey.100' },
              }}
            >
              Sign in with Google
            </Button>
          </form>
        </Box>
      </Paper>
    </Container>
  );
}
