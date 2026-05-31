// src/components/recipes/RecipeSharingDialog.tsx
'use client';

import { useEffect, useRef } from 'react';
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  Drawer,
  IconButton,
  InputBase,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';
import type { PendingRecipeInvitation, SharedUser } from '@/lib/recipe-sharing-utils';
import { RECIPE_ACCENT_MUTED } from './recipe-display-utils';

export interface RecipeSharingDialogProps {
  open: boolean;
  onClose: () => void;
  pendingInvitations: PendingRecipeInvitation[];
  onAcceptInvitation: (userId: string) => void;
  onRejectInvitation: (userId: string) => void;
  shareTags: boolean;
  onShareTagsChange: (v: boolean) => void;
  shareRatings: boolean;
  onShareRatingsChange: (v: boolean) => void;
  shareEmail: string;
  onShareEmailChange: (v: string) => void;
  onInviteUser: () => void;
  sharedUsers: SharedUser[];
  onRemoveUser: (userId: string) => void;
}

// ─── sub-components ─────────────────────────────────────────────────────────

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

const RecipeAvatar = ({ name, size = 32 }: { name: string; size?: number }) => (
  <Box
    sx={{
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: '50%',
      bgcolor: RECIPE_ACCENT_MUTED,
      color: tokens.section.recipes,
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

interface CheckboxRowProps {
  label: string;
  subText: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

/** Bordered selectable card with a custom checkbox + sub-text (matches the artboard). */
const CheckboxRow = ({ label, subText, checked, onChange }: CheckboxRowProps) => (
  <ButtonBase
    aria-label={label}
    aria-pressed={checked}
    onClick={() => onChange(!checked)}
    sx={{
      width: '100%',
      justifyContent: 'flex-start',
      textAlign: 'left',
      gap: 1.25,
      px: 1.5,
      py: 1.25,
      borderRadius: `${tokens.radius.lg}px`,
      border: `1px solid ${checked ? `${tokens.section.recipes}55` : tokens.border.subtle}`,
      bgcolor: checked ? RECIPE_ACCENT_MUTED : 'transparent',
    }}
  >
    <Box
      sx={{
        width: 18,
        height: 18,
        flexShrink: 0,
        borderRadius: '5px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1.5px solid ${checked ? tokens.section.recipes : tokens.border.strong}`,
        bgcolor: checked ? tokens.section.recipes : 'transparent',
      }}
    >
      {checked && <Icon name="check" size={13} color="#0c1118" />}
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary }}>{label}</Box>
      <Box sx={{ fontSize: 11, color: tokens.text.secondary }}>{subText}</Box>
    </Box>
  </ButtonBase>
);

// ─── body ────────────────────────────────────────────────────────────────────

interface BodyProps extends RecipeSharingDialogProps {
  emailRef: React.RefObject<HTMLInputElement | null>;
  sheet: boolean;
}

function Body({
  onClose,
  pendingInvitations,
  onAcceptInvitation,
  onRejectInvitation,
  shareTags,
  onShareTagsChange,
  shareRatings,
  onShareRatingsChange,
  shareEmail,
  onShareEmailChange,
  onInviteUser,
  sharedUsers,
  onRemoveUser,
  emailRef,
  sheet,
}: BodyProps) {
  const canInvite = shareEmail.trim().length > 0 && (shareTags || shareRatings);

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
                Share recipe data
              </Box>
              <Box sx={{ fontSize: 11, color: tokens.text.secondary }}>
                Share your tags, ratings, or both
              </Box>
            </Box>
            <Button
              onClick={onClose}
              sx={{ minWidth: 56, fontWeight: 600, color: tokens.section.recipes }}
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
            Share recipe data
          </Box>
          <Box sx={{ fontSize: 12, color: tokens.text.secondary, mt: 0.5 }}>
            Invite users to see your tags, ratings, or both.
          </Box>
        </Box>
      )}

      {/* Content */}
      <Box sx={{ px: { xs: 2.25, md: 2.75 }, py: 2.25, overflowY: 'auto' }}>
        {/* Pending invitations */}
        {pendingInvitations.length > 0 && (
          <>
            <FieldLabel>Pending invitations · {pendingInvitations.length}</FieldLabel>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2.25 }}>
              {pendingInvitations.map((inv) => {
                const name = inv.ownerName || inv.ownerEmail;
                const types = inv.invitation.sharingTypes.join(' + ');
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
                    <RecipeAvatar name={name} />
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
                        wants to share their{' '}
                        <Box component="span" sx={{ color: tokens.text.primary }}>
                          {types}
                        </Box>
                      </Box>
                    </Box>
                    <IconButton
                      aria-label={`Accept ${name}`}
                      onClick={() => onAcceptInvitation(inv.invitation.userId)}
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
                      aria-label={`Reject ${name}`}
                      onClick={() => onRejectInvitation(inv.invitation.userId)}
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

        {/* What to share */}
        <FieldLabel>What to share</FieldLabel>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2.25 }}>
          <CheckboxRow
            label="Tags"
            subText="Categories you've added to recipes"
            checked={shareTags}
            onChange={onShareTagsChange}
          />
          <CheckboxRow
            label="Ratings"
            subText="Your star ratings"
            checked={shareRatings}
            onChange={onShareRatingsChange}
          />
        </Box>

        {/* Invite by email */}
        <FieldLabel>Invite by email</FieldLabel>
        <Box sx={{ display: 'flex', gap: 1, mb: 2.25 }}>
          <InputBase
            inputRef={emailRef}
            value={shareEmail}
            onChange={(e) => onShareEmailChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canInvite) onInviteUser();
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
            onClick={onInviteUser}
            disabled={!canInvite}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              px: 2,
              bgcolor: tokens.section.recipes,
              color: '#0c1118',
              '&:hover': { bgcolor: tokens.section.recipes, filter: 'brightness(1.08)' },
            }}
          >
            Invite
          </Button>
        </Box>

        {/* Shared with */}
        {sharedUsers.length > 0 && (
          <>
            <FieldLabel>Shared with · {sharedUsers.length}</FieldLabel>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {sharedUsers.map((user) => {
                const name = user.name || user.email;
                const types = user.sharingTypes.join(' + ');
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
                    <RecipeAvatar name={name} size={28} />
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
                        sharing {types}
                      </Box>
                    </Box>
                    <IconButton
                      aria-label={`Remove ${name}`}
                      onClick={() => onRemoveUser(user.userId)}
                      size="small"
                      sx={{ color: tokens.state.danger }}
                    >
                      <Icon name="delete" size={18} color={tokens.state.danger} />
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
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              bgcolor: tokens.section.recipes,
              color: '#0c1118',
              '&:hover': { bgcolor: tokens.section.recipes, filter: 'brightness(1.08)' },
            }}
          >
            Done
          </Button>
        </Box>
      )}
    </Box>
  );
}

// ─── export ──────────────────────────────────────────────────────────────────

export function RecipeSharingDialog(props: RecipeSharingDialogProps) {
  const { open, onClose } = props;
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const emailRef = useRef<HTMLInputElement | null>(null);

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
        maxWidth={false}
        slotProps={{
          paper: {
            sx: {
              bgcolor: tokens.surface.raised,
              borderRadius: `${tokens.radius.xxxl}px`,
              border: `1px solid ${tokens.border.subtle}`,
              width: 560,
            },
          },
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
