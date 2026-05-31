'use client';

import { Box, Button, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { tokens } from '@/lib/design-tokens';

export interface PendingInvite {
  storeId: string;
  storeName: string;
  storeEmoji?: string;
  inviterName?: string;
  invitedAt?: Date | string;
}

interface PendingInviteBannerProps {
  invite: PendingInvite;
  onAccept: (storeId: string) => void;
  onDecline: (storeId: string) => void;
}

export function PendingInviteBanner({ invite, onAccept, onDecline }: PendingInviteBannerProps) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        bgcolor: tokens.state.warnMuted,
        border: `1px solid ${tokens.state.warn}55`,
        borderRadius: { xs: '12px', md: '14px' },
        p: { xs: 1.75, md: 2.25 },
        mb: { xs: 2, md: 3 },
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'center' },
        gap: 1.5,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          component="span"
          sx={{
            display: 'block',
            fontSize: { xs: 11, md: 12 },
            fontWeight: 700,
            letterSpacing: { xs: '0.08em', md: '0.10em' },
            textTransform: 'uppercase',
            color: tokens.state.warn,
            mb: 0.5,
          }}
        >
          Pending invitation
        </Typography>
        <Typography
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontWeight: 700,
            color: tokens.text.primary,
            lineHeight: 1.2,
          }}
        >
          {invite.storeEmoji ? `${invite.storeEmoji} ` : ''}
          {invite.storeName}
        </Typography>
        {invite.inviterName && (
          <Typography sx={{ fontSize: 12, color: tokens.text.secondary, mt: 0.25 }}>
            Invited by {invite.inviterName}
          </Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
        <Button
          onClick={() => onAccept(invite.storeId)}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            fontSize: 13,
            minHeight: 34,
            px: 2,
            borderRadius: '10px',
            color: tokens.onAccent.shop,
            bgcolor: theme.palette.primary.main,
            '&:hover': { bgcolor: theme.palette.primary.main, filter: 'brightness(0.94)' },
          }}
        >
          Accept
        </Button>
        <Button
          onClick={() => onDecline(invite.storeId)}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            fontSize: 13,
            minHeight: 34,
            px: 2,
            borderRadius: '10px',
            color: tokens.text.secondary,
            border: `1px solid ${tokens.border.strong}`,
            '&:hover': { bgcolor: tokens.border.subtle },
          }}
        >
          Decline
        </Button>
      </Box>
    </Box>
  );
}
