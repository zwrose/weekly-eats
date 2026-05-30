// src/components/meal-plans/ShareMealPlansDialog.tsx
'use client';

import { useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Dialog,
  Drawer,
  IconButton,
  InputBase,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';
import type { PendingMealPlanInvitation, SharedUser } from '@/lib/meal-plan-sharing-utils';

export interface ShareMealPlansDialogProps {
  open: boolean;
  onClose: () => void;
  pendingInvitations: PendingMealPlanInvitation[];
  sharedUsers: SharedUser[];
  email: string;
  onEmailChange: (value: string) => void;
  onInvite: () => void;
  onAccept: (userId: string) => void;
  onReject: (userId: string) => void;
  onRemove: (userId: string) => void;
}

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <Box
    sx={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: tokens.text.secondary,
      mb: 1,
    }}
  >
    {children}
  </Box>
);

const Avatar = ({ name, size = 32 }: { name: string; size?: number }) => (
  <Box
    sx={{
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: '50%',
      bgcolor: tokens.accent.muted,
      color: tokens.section.plans,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: size * 0.42,
    }}
  >
    {(name || '?').charAt(0).toUpperCase()}
  </Box>
);

const StatusPill = ({ status }: { status: 'pending' | 'accepted' }) => {
  const accepted = status === 'accepted';
  return (
    <Box
      component="span"
      sx={{
        flexShrink: 0,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        px: 0.75,
        py: '3px',
        borderRadius: `${tokens.radius.xs}px`,
        color: accepted ? tokens.state.success : tokens.state.warn,
        bgcolor: accepted ? tokens.state.successMuted : tokens.state.warnMuted,
      }}
    >
      {status}
    </Box>
  );
};

function Body({
  onClose,
  pendingInvitations,
  sharedUsers,
  email,
  onEmailChange,
  onInvite,
  onAccept,
  onReject,
  onRemove,
  emailRef,
  sheet,
}: ShareMealPlansDialogProps & {
  emailRef: React.RefObject<HTMLInputElement | null>;
  sheet: boolean;
}) {
  const canInvite = email.trim().length > 0;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: sheet ? undefined : 480 }}>
      {/* Header */}
      {sheet ? (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1, pb: 0.5 }}>
            <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: tokens.border.strong }} />
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
              py: 1.25,
              borderBottom: `1px solid ${tokens.border.subtle}`,
            }}
          >
            <Box sx={{ minWidth: 56 }} />
            <Box sx={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
              <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>
                Share meal plans
              </Box>
              <Box sx={{ fontSize: 11, color: tokens.text.secondary }}>
                Invited people can view + edit
              </Box>
            </Box>
            <Button
              onClick={onClose}
              sx={{ minWidth: 56, fontWeight: 600, color: tokens.section.plans }}
            >
              Done
            </Button>
          </Box>
        </Box>
      ) : (
        <Box
          sx={{ px: 2.75, pt: 2.25, pb: 1.75, borderBottom: `1px solid ${tokens.border.subtle}` }}
        >
          <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>
            Share your meal plans
          </Box>
          <Box sx={{ fontSize: 12, color: tokens.text.secondary, mt: 0.5 }}>
            Invited people can view and edit all your plans.
          </Box>
        </Box>
      )}

      {/* Content */}
      <Box sx={{ px: { xs: 2.25, md: 2.75 }, py: 2.25, overflowY: 'auto' }}>
        {pendingInvitations.length > 0 && (
          <>
            <FieldLabel>Pending invitations · {pendingInvitations.length}</FieldLabel>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2.25 }}>
              {pendingInvitations.map((inv) => {
                const name = inv.ownerName || inv.ownerEmail;
                return (
                  <Box
                    key={inv.invitation.userId}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      p: 1.25,
                      bgcolor: tokens.surface.elevated,
                      borderRadius: `${tokens.radius.lg}px`,
                    }}
                  >
                    <Avatar name={name} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box
                        sx={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: tokens.text.primary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {name}
                      </Box>
                      <Box sx={{ fontSize: 11, color: tokens.text.secondary }}>
                        invited you to{' '}
                        <Box component="span" sx={{ color: tokens.text.primary }}>
                          their meal plans
                        </Box>
                      </Box>
                    </Box>
                    <IconButton
                      aria-label={`Accept invitation from ${name}`}
                      onClick={() => onAccept(inv.invitation.userId)}
                      sx={{
                        width: 34,
                        height: 34,
                        borderRadius: `${tokens.radius.sm}px`,
                        color: tokens.state.success,
                        bgcolor: tokens.state.successMuted,
                      }}
                    >
                      <Icon name="check" size={18} />
                    </IconButton>
                    <IconButton
                      aria-label={`Decline invitation from ${name}`}
                      onClick={() => onReject(inv.invitation.userId)}
                      sx={{
                        width: 34,
                        height: 34,
                        borderRadius: `${tokens.radius.sm}px`,
                        color: tokens.state.danger,
                        bgcolor: tokens.state.dangerMuted,
                      }}
                    >
                      <Icon name="close" size={18} />
                    </IconButton>
                  </Box>
                );
              })}
            </Box>
          </>
        )}

        <FieldLabel>Invite by email</FieldLabel>
        <Box sx={{ display: 'flex', gap: 1, mb: 2.25 }}>
          <InputBase
            inputRef={emailRef}
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canInvite) onInvite();
            }}
            type="email"
            placeholder="someone@example.com"
            inputProps={{ 'aria-label': 'Email Address' }}
            sx={{
              flex: 1,
              height: 42,
              px: 1.5,
              bgcolor: tokens.surface.elevated,
              border: `1px solid ${tokens.border.strong}`,
              borderRadius: `${tokens.radius.lg}px`,
              fontSize: 13,
              color: tokens.text.primary,
              '& input::placeholder': { color: tokens.text.muted, opacity: 1 },
            }}
          />
          <Button
            variant="contained"
            onClick={onInvite}
            disabled={!canInvite}
            sx={{ textTransform: 'none', fontWeight: 600, px: 2 }}
          >
            Invite
          </Button>
        </Box>

        {sharedUsers.length > 0 && (
          <>
            <FieldLabel>Shared with</FieldLabel>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {sharedUsers.map((user) => {
                const name = user.name || user.email;
                return (
                  <Box
                    key={user.userId}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      p: 1.25,
                      border: `1px solid ${tokens.border.subtle}`,
                      borderRadius: `${tokens.radius.lg}px`,
                    }}
                  >
                    <Avatar name={name} size={28} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box
                        sx={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: tokens.text.primary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {name}
                      </Box>
                      <Box
                        sx={{
                          fontSize: 11,
                          color: tokens.text.secondary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {user.email}
                      </Box>
                    </Box>
                    {user.status && <StatusPill status={user.status} />}
                    <IconButton
                      aria-label={`Remove ${name}`}
                      onClick={() => onRemove(user.userId)}
                      size="small"
                      sx={{ color: tokens.text.muted }}
                    >
                      <Icon name="close" size={18} />
                    </IconButton>
                  </Box>
                );
              })}
            </Box>
          </>
        )}

        {pendingInvitations.length === 0 && sharedUsers.length === 0 && (
          <Box sx={{ fontSize: 13, color: tokens.text.muted, py: 0.5 }}>
            No one yet — invite someone above.
          </Box>
        )}
      </Box>

      {/* Desktop footer */}
      {!sheet && (
        <Box
          sx={{
            px: 2.75,
            py: 1.5,
            borderTop: `1px solid ${tokens.border.subtle}`,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <Button
            variant="contained"
            onClick={onClose}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Done
          </Button>
        </Box>
      )}
    </Box>
  );
}

export function ShareMealPlansDialog(props: ShareMealPlansDialogProps) {
  const { open, onClose } = props;
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const emailRef = useRef<HTMLInputElement | null>(null);

  // Focus the email field when the surface opens (auto-focus parity with the old dialog).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => emailRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  const body = <Body {...props} emailRef={emailRef} sheet={!isDesktop} />;

  if (isDesktop) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        slotProps={{
          paper: { sx: { bgcolor: tokens.surface.sheet, borderRadius: `${tokens.radius.xl}px` } },
        }}
      >
        {body}
      </Dialog>
    );
  }
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            bgcolor: tokens.surface.sheet,
            borderTopLeftRadius: tokens.radius.sheet,
            borderTopRightRadius: tokens.radius.sheet,
            maxHeight: '92%',
          },
        },
      }}
    >
      {body}
    </Drawer>
  );
}
