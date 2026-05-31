'use client';

import { Box, ButtonBase } from '@mui/material';
import { tokens } from '@/lib/design-tokens';
import type { ActiveUser, ShoppingSyncConnectionState } from '@/lib/hooks/use-shopping-sync';
import { PresenceAvatar } from './PresenceAvatar';

export interface PresencePillProps {
  connectionState: ShoppingSyncConnectionState;
  activeUsers: ActiveUser[];
  onReconnect: () => void;
}

const MAX_AVATARS = 3;

/** 6px status dot */
function StatusDot({ color }: { color: string }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        bgcolor: color,
        flexShrink: 0,
      }}
    />
  );
}

/**
 * Unified presence pill: shows connection state + co-viewers in one compact
 * inline control. Replaces the ad-hoc live pill + "Also viewing" row that
 * previously lived as inline JSX in page.tsx.
 */
export function PresencePill({ connectionState, activeUsers, onReconnect }: PresencePillProps) {
  const pillBase = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.75,
    px: 1,
    py: 0.5,
    borderRadius: `${tokens.radius.pill}px`,
    border: `1px solid ${tokens.border.subtle}`,
    bgcolor: tokens.surface.raised,
    userSelect: 'none',
    flexShrink: 0,
  } as const;

  const labelStyle = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: tokens.text.secondary,
    lineHeight: 1,
  } as const;

  // ── connected ────────────────────────────────────────────────────────────
  if (connectionState === 'connected') {
    const visibleUsers = activeUsers.slice(0, MAX_AVATARS);
    const overflow = activeUsers.length - MAX_AVATARS;

    return (
      <Box sx={pillBase}>
        <StatusDot color={tokens.state.success} />
        {activeUsers.length === 0 ? (
          <Box component="span" sx={labelStyle}>
            LIVE
          </Box>
        ) : (
          <>
            {/* Stacked avatars with negative-margin overlap */}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {visibleUsers.map((user, i) => (
                <Box
                  key={user.email}
                  sx={{ ml: i === 0 ? 0 : -0.75, zIndex: visibleUsers.length - i }}
                >
                  <PresenceAvatar name={user.name} email={user.email} size={20} ring />
                </Box>
              ))}
            </Box>
            {overflow > 0 && (
              <Box component="span" sx={{ ...labelStyle, color: tokens.text.secondary }}>
                +{overflow}
              </Box>
            )}
          </>
        )}
      </Box>
    );
  }

  // ── connecting / initialized ──────────────────────────────────────────────
  if (connectionState === 'connecting' || connectionState === 'initialized') {
    return (
      <Box sx={pillBase}>
        <StatusDot color={tokens.state.warn} />
        <Box component="span" sx={{ ...labelStyle, color: tokens.state.warn }}>
          CONNECTING…
        </Box>
      </Box>
    );
  }

  // ── failed ────────────────────────────────────────────────────────────────
  if (connectionState === 'failed') {
    return (
      <Box
        sx={{
          ...pillBase,
          border: `1px solid ${tokens.state.dangerMuted}`,
          bgcolor: tokens.state.dangerMuted,
          gap: 1,
        }}
      >
        <StatusDot color={tokens.state.danger} />
        <Box component="span" sx={{ ...labelStyle, color: tokens.state.danger }}>
          SYNC FAILED
        </Box>
        <ButtonBase
          role="button"
          aria-label="Retry"
          onClick={onReconnect}
          sx={{
            px: 0.75,
            py: 0.25,
            borderRadius: `${tokens.radius.sm}px`,
            bgcolor: tokens.state.danger,
            color: tokens.onDanger,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            lineHeight: 1.4,
          }}
        >
          Retry
        </ButtonBase>
      </Box>
    );
  }

  // ── offline: disconnected | suspended | closing | closed | unknown ────────
  return (
    <ButtonBase
      onClick={onReconnect}
      sx={{
        ...pillBase,
        border: `1px solid ${tokens.state.dangerMuted}`,
        bgcolor: tokens.state.dangerMuted,
        cursor: 'pointer',
      }}
    >
      <StatusDot color={tokens.state.danger} />
      <Box component="span" sx={{ ...labelStyle, color: tokens.state.danger }}>
        OFFLINE
      </Box>
    </ButtonBase>
  );
}
