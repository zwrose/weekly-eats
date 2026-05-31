'use client';

import { useEffect, useRef } from 'react';
import { Box, Button, Dialog, IconButton, InputBase } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';
import { PresenceAvatar } from '@/components/shopping-list/Presence/PresenceAvatar';

export interface ShareStoreInvitation {
  userId: string;
  userEmail: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface ShareStoreDialogProps {
  open: boolean;
  storeName: string;
  invitations: ShareStoreInvitation[];
  email: string;
  onEmailChange: (value: string) => void;
  onInvite: () => void;
  onRemove: (userId: string) => void;
  onClose: () => void;
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
        borderRadius: `${tokens.radius.pill}px`,
        color: accepted ? tokens.state.success : tokens.text.secondary,
        bgcolor: accepted ? tokens.state.successMuted : 'transparent',
        border: `1px solid ${accepted ? 'transparent' : tokens.border.strong}`,
      }}
    >
      {accepted ? 'accepted' : 'pending'}
    </Box>
  );
};

function Body({
  storeName,
  invitations,
  email,
  onEmailChange,
  onInvite,
  onRemove,
  onClose,
  emailRef,
}: Omit<ShareStoreDialogProps, 'open'> & {
  emailRef: React.RefObject<HTMLInputElement | null>;
}) {
  const accent = tokens.section.shop;
  const canInvite = email.trim().length > 0;
  const shared = invitations.filter((inv) => inv.status === 'accepted' || inv.status === 'pending');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Header */}
      <Box sx={{ px: 2.75, pt: 2.25, pb: 1.75, borderBottom: `1px solid ${tokens.border.subtle}` }}>
        <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>
          Share &ldquo;{storeName}&rdquo;
        </Box>
        <Box sx={{ fontSize: 12, color: tokens.text.secondary, mt: 0.5 }}>
          Invite people by email. They can view and edit this shopping list.
        </Box>
      </Box>

      {/* Content */}
      <Box
        sx={{
          px: { xs: 2.25, md: 2.75 },
          py: 2.25,
          overflowY: 'auto',
          flex: { xs: 1, sm: '0 1 auto' },
          minHeight: 0,
        }}
      >
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
            placeholder="user@example.com"
            inputProps={{ 'aria-label': 'Email Address' }}
            sx={{
              flex: 1,
              height: 40,
              px: 1.5,
              bgcolor: tokens.surface.elevated,
              border: `1px solid ${tokens.border.strong}`,
              borderRadius: `${tokens.radius.lg}px`,
              fontSize: 14,
              color: tokens.text.primary,
              '& input::placeholder': { color: tokens.text.muted, opacity: 1 },
              '&.Mui-focused': {
                border: `1px solid ${accent}`,
                boxShadow: `0 0 0 3px ${alpha(accent, 0.14)}`,
              },
            }}
          />
          <Button
            onClick={onInvite}
            disabled={!canInvite}
            sx={{
              flexShrink: 0,
              textTransform: 'none',
              fontWeight: 700,
              bgcolor: accent,
              color: tokens.onAccent.shop,
              borderRadius: `${tokens.radius.lg}px`,
              px: 2,
              '&:hover': { bgcolor: accent, filter: 'brightness(1.05)' },
              '&.Mui-disabled': { bgcolor: tokens.surface.elevated, color: tokens.text.muted },
            }}
          >
            Invite
          </Button>
        </Box>

        {shared.length > 0 && (
          <>
            <FieldLabel>Shared with</FieldLabel>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {shared.map((inv) => {
                const pending = inv.status === 'pending';
                return (
                  <Box
                    key={inv.userId}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      p: 1.25,
                      borderRadius: `${tokens.radius.lg}px`,
                      border: pending
                        ? `1px dashed ${tokens.border.strong}`
                        : `1px solid ${tokens.border.subtle}`,
                    }}
                  >
                    <PresenceAvatar name={inv.userEmail} email={inv.userEmail} size={34} />
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
                        {inv.userEmail}
                      </Box>
                    </Box>
                    <StatusPill status={pending ? 'pending' : 'accepted'} />
                    {!pending && (
                      <IconButton
                        aria-label={`Remove ${inv.userEmail}`}
                        title="Remove user"
                        onClick={() => onRemove(inv.userId)}
                        size="small"
                        sx={{ color: tokens.state.danger }}
                      >
                        <Icon name="delete" size={18} />
                      </IconButton>
                    )}
                  </Box>
                );
              })}
            </Box>
          </>
        )}

        {shared.length === 0 && (
          <Box sx={{ fontSize: 13, color: tokens.text.muted, py: 0.5 }}>
            No one yet — invite someone above.
          </Box>
        )}
      </Box>

      {/* Footer */}
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
          onClick={onClose}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            bgcolor: accent,
            color: tokens.onAccent.shop,
            borderRadius: `${tokens.radius.lg}px`,
            px: 2.25,
            '&:hover': { bgcolor: accent, filter: 'brightness(1.05)' },
          }}
        >
          Done
        </Button>
      </Box>
    </Box>
  );
}

/**
 * Share a store: invite by email + a shared-with list (accepted / pending) with
 * remove. Full-screen frame on mobile, centered 540 dialog on desktop (artboard
 * §3.7) — consistent with the import/item-editor dialogs. The page owns the
 * invite/remove handlers and the sharing store — this component is pure UI.
 */
export function ShareStoreDialog(props: ShareStoreDialogProps) {
  const { open, onClose } = props;
  const emailRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus the email field when the surface opens (parity with old dialog).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => emailRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            // Mobile: full-screen frame (artboard §3.7); desktop: 540 dialog.
            margin: { xs: 0, sm: 'auto' },
            width: { xs: '100%', sm: 540 },
            maxWidth: { xs: '100%', sm: 540 },
            height: { xs: '100%', sm: 'auto' },
            maxHeight: { xs: '100%', sm: '85vh' },
            bgcolor: tokens.surface.raised,
            border: `1px solid ${tokens.border.strong}`,
            borderRadius: `${tokens.radius.xxxl}px`,
            boxShadow: tokens.shadow.modal,
          },
        },
      }}
    >
      <Body {...props} emailRef={emailRef} />
    </Dialog>
  );
}
