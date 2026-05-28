// src/components/nav/TopNav.tsx
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Box, Button } from '@mui/material';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';
import { NAV_SECTIONS } from '@/lib/nav-sections';
import { useActiveSection } from '@/lib/hooks/use-active-section';
import { AppIcon } from './AppIcon';
import { NavAvatar } from './NavAvatar';
import { AvatarMenu } from './AvatarMenu';

export function TopNav() {
  const router = useRouter();
  const { data: session } = useSession();
  const active = useActiveSection();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const user = session?.user;
  const name = user?.name ?? '';

  const openMenu = useCallback(
    (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget),
    []
  );
  const closeMenu = useCallback(() => setAnchorEl(null), []);

  return (
    <Box
      component="header"
      sx={{
        display: { xs: 'none', md: 'flex' },
        alignItems: 'center',
        px: 3.5,
        py: 1.5,
        bgcolor: 'background.default',
        borderBottom: `1px solid ${tokens.border.subtle}`,
      }}
    >
      <Box
        onClick={() => router.push('/meal-plans')}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <AppIcon size={30} />
        <Box
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 700,
            color: 'text.primary',
          }}
        >
          Weekly Eats
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 0.5, ml: 3.5, flex: 1 }}>
        {NAV_SECTIONS.map((s) => {
          const on = s.key === active;
          return (
            <Button
              key={s.key}
              onClick={() => router.push(s.href)}
              aria-current={on ? 'page' : undefined}
              disableRipple
              sx={{
                height: 50,
                px: 1.75,
                minWidth: 0,
                gap: 1,
                borderRadius: 0,
                color: on ? 'text.primary' : 'text.secondary',
                fontSize: 14.5,
                fontWeight: on ? 600 : 500,
                borderBottom: `2.5px solid ${on ? s.color : 'transparent'}`,
                '&:hover': { bgcolor: 'transparent', color: 'text.primary' },
              }}
            >
              <Icon name={s.icon} size={18} color={s.color} />
              {s.label}
            </Button>
          );
        })}
      </Box>

      <Button
        onClick={openMenu}
        aria-label="Account menu"
        aria-haspopup="true"
        disableRipple
        sx={{
          height: 40,
          pl: 0.75,
          pr: 1.5,
          gap: 1.25,
          borderRadius: 999,
          border: `1px solid ${tokens.border.subtle}`,
          color: 'text.primary',
          fontSize: 14,
          fontWeight: 500,
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <NavAvatar name={name} size={28} />
        {name}
      </Button>

      <AvatarMenu
        variant="menu"
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={closeMenu}
        isAdmin={Boolean(user?.isAdmin)}
      />
    </Box>
  );
}
