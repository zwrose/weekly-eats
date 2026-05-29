// src/components/nav/BottomNav.tsx
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Box, ButtonBase } from '@mui/material';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';
import { NAV_SECTIONS } from '@/lib/nav-sections';
import { useActiveSection } from '@/lib/hooks/use-active-section';
import { NavAvatar } from './NavAvatar';
import { AvatarMenu } from './AvatarMenu';

// Plans, Shop, Recipes — Pantry is NOT a mobile slot (lives in the avatar sheet).
const SLOTS = NAV_SECTIONS.filter((s) => s.key !== 'pantry');

const slotSx = (color: string) => ({
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  gap: 0.5,
  py: 0.5,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
  color,
});

export function BottomNav() {
  const router = useRouter();
  const { data: session } = useSession();
  const active = useActiveSection();
  const [sheetOpen, setSheetOpen] = useState(false);

  const user = session?.user;
  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  return (
    <>
      <Box
        component="nav"
        sx={{
          display: { xs: 'grid', md: 'none' },
          gridTemplateColumns: 'repeat(4, 1fr)',
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1100,
          pt: 1,
          pb: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
          bgcolor: 'background.paper',
          borderTop: `1px solid ${tokens.border.subtle}`,
        }}
      >
        {SLOTS.map((s) => {
          const on = s.key === active;
          return (
            <ButtonBase
              key={s.key}
              onClick={() => router.push(s.href)}
              aria-label={s.label}
              aria-current={on ? 'page' : undefined}
              sx={slotSx(on ? s.color : tokens.text.secondary)}
            >
              <Icon name={s.icon} size={22} color={on ? s.color : tokens.text.secondary} />
              {s.label}
            </ButtonBase>
          );
        })}
        <ButtonBase
          onClick={openSheet}
          aria-label="Account"
          aria-haspopup="true"
          sx={slotSx(tokens.text.secondary)}
        >
          <NavAvatar name={user?.name} image={user?.image} size={22} />
          Account
        </ButtonBase>
      </Box>

      <AvatarMenu
        variant="sheet"
        open={sheetOpen}
        onClose={closeSheet}
        isAdmin={Boolean(user?.isAdmin)}
      />
    </>
  );
}
