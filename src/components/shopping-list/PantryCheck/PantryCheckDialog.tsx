'use client';

import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { DialogTitle } from '@/components/ui/DialogTitle';
import { DialogActions } from '@/components/ui/DialogActions';
import { Icon } from '@/components/ui/Icon';
import { KeepSkipToggle } from './KeepSkipToggle';
import { tokens } from '@/lib/design-tokens';

export interface PantryCheckMatch {
  foodItemId: string;
  name: string;
  listLabel: string;
}

interface PantryCheckDialogProps {
  open: boolean;
  matches: PantryCheckMatch[];
  onApply: (decisions: Record<string, 'keep' | 'skip'>) => void;
  onClose: () => void;
}

function buildDefaultDecisions(matches: PantryCheckMatch[]): Record<string, 'keep' | 'skip'> {
  const d: Record<string, 'keep' | 'skip'> = {};
  for (const m of matches) {
    d[m.foodItemId] = 'keep';
  }
  return d;
}

export function PantryCheckDialog({ open, matches, onApply, onClose }: PantryCheckDialogProps) {
  const [decisions, setDecisions] = useState<Record<string, 'keep' | 'skip'>>(() =>
    buildDefaultDecisions(matches)
  );

  // Re-init whenever matches or open changes
  useEffect(() => {
    setDecisions(buildDefaultDecisions(matches));
  }, [matches, open]);

  const skipCount = Object.values(decisions).filter((v) => v === 'skip').length;
  const keepCount = Object.values(decisions).filter((v) => v === 'keep').length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          width: 560,
          borderRadius: tokens.radius.xxxl,
          boxShadow: tokens.shadow.modal,
        },
      }}
    >
      <DialogTitle onClose={onClose}>Pantry Check</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        {/* Pantry summary banner */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.5,
            bgcolor: alpha(tokens.section.pantry, 0.14),
            border: `1px solid ${tokens.section.pantry}44`,
            borderRadius: tokens.radius.lg,
            px: 2,
            py: 1.5,
            mb: 2,
          }}
        >
          <Icon name="kitchen" size={20} color={tokens.section.pantry} />
          <Typography variant="body2" sx={{ color: tokens.text.secondary, lineHeight: 1.5 }}>
            These items are already in your pantry. Toggle{' '}
            <Box component="span" sx={{ color: tokens.state.danger, fontWeight: 700 }}>
              Skip
            </Box>{' '}
            on items you already have to drop them from your list.
          </Typography>
        </Box>

        {/* Tally pill */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 2,
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: tokens.state.danger,
              flexShrink: 0,
            }}
          />
          <Typography variant="body2" sx={{ color: tokens.text.secondary }}>
            {`${skipCount} dropping off · ${keepCount} still on list`}
          </Typography>
        </Box>

        {/* Per-match rows */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {matches.map((match) => {
            const decision = decisions[match.foodItemId] ?? 'keep';
            const isSkip = decision === 'skip';
            return (
              <Box
                key={match.foodItemId}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2,
                  px: 1.5,
                  py: 1.25,
                  borderRadius: tokens.radius.md,
                  bgcolor: isSkip ? tokens.state.dangerMuted : 'transparent',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: 14.5,
                      fontWeight: 700,
                      lineHeight: 1.3,
                      color: isSkip ? tokens.text.muted : tokens.text.primary,
                      textDecoration: isSkip ? 'line-through' : 'none',
                      transition: 'color 0.15s ease',
                    }}
                  >
                    {match.name}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: 12,
                      color: tokens.text.secondary,
                      mt: 0.25,
                    }}
                  >
                    {match.listLabel}
                  </Typography>
                </Box>
                <KeepSkipToggle
                  value={decision}
                  onChange={(next) =>
                    setDecisions((prev) => ({ ...prev, [match.foodItemId]: next }))
                  }
                />
              </Box>
            );
          })}
        </Box>
      </DialogContent>

      <DialogActions primaryButtonIndex={1}>
        <Button onClick={onClose} sx={{ width: { xs: '100%', sm: 'auto' } }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => onApply(decisions)}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
}
