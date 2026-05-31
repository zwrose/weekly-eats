import { redirect } from 'next/navigation';
import { Box, Button, Container, Paper, Stack, Typography } from '@mui/material';
import Image from 'next/image';
import { auth } from '@/lib/auth';
import { peekAuthState } from '@/lib/mcp/oauth/stores/auth-states';
import { getClient } from '@/lib/mcp/oauth/stores/clients';

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { mcp_auth } = await searchParams;
  const nonce = typeof mcp_auth === 'string' ? mcp_auth : '';

  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const state = nonce ? await peekAuthState(nonce, Date.now()) : null;
  if (!state) redirect('/');

  const client = await getClient(state.clientId);
  const clientName = client?.clientName ?? 'This application';

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 8 } }}>
      <Paper sx={{ p: { xs: 3, sm: 4 } }} elevation={2}>
        <Box sx={{ mb: 2 }}>
          <Image src="/icon0.svg" alt="Weekly Eats" width={40} height={40} priority />
        </Box>
        <Typography variant="h5" component="h1" gutterBottom>
          Authorize access
        </Typography>
        <Typography variant="body1" sx={{ mb: 3 }}>
          Allow <strong>{clientName}</strong> to read and modify your Weekly Eats recipes, food
          items, meal plans, pantry, and shopping lists?
        </Typography>
        <Stack
          direction={{ xs: 'column-reverse', sm: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'flex-end' }}
        >
          <Box component="form" action="/api/mcp/oauth/authorize/decision" method="POST">
            <input type="hidden" name="mcp_auth" value={nonce} />
            <input type="hidden" name="decision" value="deny" />
            <Button type="submit" variant="outlined" color="inherit" fullWidth>
              Deny
            </Button>
          </Box>
          <Box component="form" action="/api/mcp/oauth/authorize/decision" method="POST">
            <input type="hidden" name="mcp_auth" value={nonce} />
            <input type="hidden" name="decision" value="allow" />
            <Button type="submit" variant="contained" fullWidth>
              Allow
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
}
