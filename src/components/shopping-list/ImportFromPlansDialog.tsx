'use client';

import { Box, Button, ButtonBase, Dialog } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { tokens } from '@/lib/design-tokens';
import { Icon } from '@/components/ui/Icon';

export interface ImportPlanOption {
  _id: string;
  name: string;
  startDate: string | Date;
}

export interface ImportFromPlansDialogProps {
  open: boolean;
  plans: ImportPlanOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onImport: () => void;
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

/**
 * Pick one or more recent meal plans to import their food items into the
 * working shopping list. Pure selection UI — the page owns `availableMealPlans`,
 * the selection set, and the import handler. Restyled to the dark dialog vocab
 * (accent-selected rows, 22x22 checkboxes).
 */
export function ImportFromPlansDialog({
  open,
  plans,
  selectedIds,
  onToggle,
  onImport,
  onClose,
}: ImportFromPlansDialogProps) {
  const accent = tokens.section.shop;
  const canImport = selectedIds.length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="import-plans-title"
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
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <Box
          sx={{ px: 2.75, pt: 2.25, pb: 1.75, borderBottom: `1px solid ${tokens.border.subtle}` }}
        >
          <Box
            id="import-plans-title"
            sx={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}
          >
            Select meal plans
          </Box>
          <Box sx={{ fontSize: 12, color: tokens.text.secondary, mt: 0.5 }}>
            Add every food item from the chosen plans (including from recipes) to your list.
          </Box>
        </Box>

        <Box
          sx={{
            px: 2.75,
            py: 2.25,
            overflowY: 'auto',
            flex: { xs: 1, sm: '0 1 auto' },
            minHeight: 0,
            maxHeight: { sm: '60vh' },
          }}
        >
          {plans.length === 0 ? (
            <Box
              sx={{
                p: 2,
                borderRadius: `${tokens.radius.lg}px`,
                border: `1px solid ${tokens.border.subtle}`,
                bgcolor: tokens.surface.elevated,
                fontSize: 13,
                color: tokens.text.secondary,
              }}
            >
              No meal plans available (must be within the last 3 days or in the future).
            </Box>
          ) : (
            <>
              <FieldLabel>Recent plans</FieldLabel>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {plans.map((plan) => {
                  const selected = selectedIds.includes(plan._id);
                  return (
                    <ButtonBase
                      key={plan._id}
                      onClick={() => onToggle(plan._id)}
                      role="checkbox"
                      aria-checked={selected}
                      aria-label={plan.name}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        p: 1.25,
                        textAlign: 'left',
                        justifyContent: 'flex-start',
                        borderRadius: `${tokens.radius.lg}px`,
                        border: `1px solid ${selected ? accent : tokens.border.subtle}`,
                        bgcolor: selected ? alpha(accent, 0.1) : 'transparent',
                        '&:hover': {
                          bgcolor: selected ? alpha(accent, 0.14) : tokens.surface.elevated,
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: 22,
                          height: 22,
                          flexShrink: 0,
                          borderRadius: `${tokens.radius.sm}px`,
                          border: `1.5px solid ${selected ? accent : tokens.border.strong}`,
                          bgcolor: selected ? accent : 'transparent',
                          color: tokens.onAccent.shop,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {selected && <Icon name="check" size={16} weight={700} />}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.75,
                            minWidth: 0,
                          }}
                        >
                          <Icon name="event_note" size={18} color={tokens.section.plans} />
                          <Box
                            sx={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: tokens.text.primary,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {plan.name}
                          </Box>
                        </Box>
                        <Box sx={{ fontSize: 12, color: tokens.text.secondary }}>
                          {new Date(plan.startDate).toLocaleDateString()}
                        </Box>
                      </Box>
                    </ButtonBase>
                  );
                })}
              </Box>
            </>
          )}
        </Box>

        <Box
          sx={{
            px: 2.75,
            py: 1.5,
            borderTop: `1px solid ${tokens.border.subtle}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1,
          }}
        >
          <Button
            onClick={onClose}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              color: tokens.text.secondary,
              border: `1px solid ${tokens.border.subtle}`,
              borderRadius: `${tokens.radius.lg}px`,
              px: 2,
              '&:hover': { bgcolor: 'transparent', color: tokens.text.primary },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={onImport}
            disabled={!canImport}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              bgcolor: accent,
              color: tokens.onAccent.shop,
              borderRadius: `${tokens.radius.lg}px`,
              px: 2.25,
              '&:hover': { bgcolor: accent, filter: 'brightness(1.05)' },
              '&.Mui-disabled': { bgcolor: tokens.surface.elevated, color: tokens.text.muted },
            }}
          >
            Add Items
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}
