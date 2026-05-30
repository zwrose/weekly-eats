'use client';

import { styled, Switch } from '@mui/material';
import { tokens } from '@/lib/design-tokens';

/**
 * Compact 36×22 pill toggle used across the redesign (Template "meals to plan",
 * meal-editor "skip this meal", etc.). The track adopts the active section accent
 * (`palette.primary`, rebound per section by SectionThemeProvider) when on, and the
 * strong border color when off, with an 18px white knob — replacing MUI's default switch.
 */
export const PillSwitch = styled(Switch)(({ theme }) => ({
  width: 36,
  height: 22,
  padding: 0,
  '& .MuiSwitch-switchBase': {
    padding: '2px',
    '&.Mui-checked': {
      transform: 'translateX(14px)',
      color: '#fff',
      '& + .MuiSwitch-track': {
        backgroundColor: theme.palette.primary.main,
        opacity: 1,
      },
    },
  },
  '& .MuiSwitch-thumb': { width: 18, height: 18, boxShadow: 'none' },
  '& .MuiSwitch-track': {
    borderRadius: '11px',
    backgroundColor: tokens.border.strong,
    opacity: 1,
  },
}));
