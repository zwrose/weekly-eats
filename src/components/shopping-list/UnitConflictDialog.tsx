'use client';

import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  Drawer,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { tokens } from '@/lib/design-tokens';
import { Icon } from '@/components/ui/Icon';
import QuantityInput from '@/components/food-item-inputs/QuantityInput';
import { getUnitOptions, getUnitForm } from '@/lib/food-items-utils';

export interface UnitConflictBreakdownEntry {
  quantity: number;
  unit: string;
}

export interface UnitConflictView {
  foodItemId: string;
  foodItemName: string;
  isAutoConverted: boolean;
  suggestedQuantity?: number;
  suggestedUnit?: string;
  unitBreakdown?: UnitConflictBreakdownEntry[];
}

export interface UnitConflictDialogProps {
  open: boolean;
  conflict: UnitConflictView | null;
  index: number;
  total: number;
  quantity: number;
  unit: string;
  resolved: boolean;
  isLast: boolean;
  onQuantityChange: (quantity: number) => void;
  onUnitChange: (unit: string) => void;
  onPrevious: () => void;
  onNext: () => void;
}

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
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

function Body({
  conflict,
  index,
  total,
  quantity,
  unit,
  resolved,
  isLast,
  onQuantityChange,
  onUnitChange,
  onPrevious,
  onNext,
  sheet,
}: Omit<UnitConflictDialogProps, 'open'> & { sheet: boolean }) {
  const accent = tokens.section.shop;

  const accentFieldSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: tokens.surface.elevated,
      '& fieldset': { borderColor: tokens.border.strong },
      '&.Mui-focused fieldset': { borderColor: accent, borderWidth: 1 },
      '&.Mui-focused': { boxShadow: `0 0 0 3px ${alpha(accent, 0.14)}` },
    },
  } as const;

  if (!conflict) return null;

  const suggested =
    conflict.suggestedQuantity !== undefined
      ? Math.round(conflict.suggestedQuantity * 100) / 100
      : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: sheet ? undefined : 460 }}>
      {sheet && (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1, pb: 0.5 }}>
          <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: tokens.border.strong }} />
        </Box>
      )}

      <Box sx={{ px: { xs: 2.25, md: 2.75 }, pt: sheet ? 1 : 2.25, pb: 1.5 }}>
        <Eyebrow>
          Unit conflict · {index + 1} of {total}
        </Eyebrow>
        <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>
          {conflict.foodItemName}
        </Box>
      </Box>

      <Box sx={{ px: { xs: 2.25, md: 2.75 }, pb: 2.25, overflowY: 'auto' }}>
        {/* Suggestion / info banner */}
        {conflict.isAutoConverted && suggested !== null ? (
          <Box
            sx={{
              p: 1.5,
              mb: 2,
              borderRadius: `${tokens.radius.lg}px`,
              bgcolor: alpha(accent, 0.14),
              border: `1px solid ${alpha(accent, 0.2)}`,
              fontSize: 13,
              color: tokens.text.primary,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                mb: 0.75,
              }}
            >
              <Icon name="auto_fix_high" size={14} color={accent} />
              <Box
                component="span"
                sx={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: accent,
                }}
              >
                Suggested: {suggested}
                {conflict.suggestedUnit ? ` ${getUnitForm(conflict.suggestedUnit, suggested)}` : ''}
              </Box>
            </Box>
            {conflict.unitBreakdown?.map((entry, idx) => (
              <Box component="span" key={idx}>
                {idx > 0 && ' + '}
                {entry.quantity} {getUnitForm(entry.unit, entry.quantity)}
              </Box>
            ))}
            {' = '}
            {suggested}{' '}
            {conflict.suggestedUnit ? getUnitForm(conflict.suggestedUnit, suggested) : ''}
          </Box>
        ) : (
          <Box
            sx={{
              p: 1.5,
              mb: 2,
              borderRadius: `${tokens.radius.lg}px`,
              bgcolor: tokens.surface.elevated,
              border: `1px solid ${tokens.border.subtle}`,
              fontSize: 13,
              color: tokens.text.secondary,
            }}
          >
            This item has different units that can&apos;t be auto-converted. Choose the quantity and
            unit for your list.
          </Box>
        )}

        {/* Source rows */}
        <Eyebrow>Unit entries to combine</Eyebrow>
        <Box
          sx={{
            p: 1.5,
            mb: 2.25,
            borderRadius: `${tokens.radius.lg}px`,
            border: `1px solid ${tokens.border.subtle}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
          }}
        >
          {conflict.unitBreakdown?.map((entry, idx) => (
            <Box key={idx} sx={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary }}>
              {entry.quantity} {getUnitForm(entry.unit, entry.quantity)}
            </Box>
          ))}
        </Box>

        <Box sx={{ fontSize: 12, color: tokens.text.secondary, mb: 1.5 }}>
          {conflict.isAutoConverted
            ? 'Review the suggested combined value:'
            : 'Set the quantity and unit for your shopping list:'}
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mb: 2.5 }}>
          <QuantityInput
            label="Quantity"
            value={quantity}
            onChange={onQuantityChange}
            size="small"
            sx={{ width: 140, ...accentFieldSx }}
          />
          <Autocomplete
            options={getUnitOptions()}
            value={getUnitOptions().find((option) => option.value === unit) ?? null}
            onChange={(_, value) => {
              if (value) onUnitChange(value.value);
            }}
            getOptionLabel={(option) => getUnitForm(option.value, quantity)}
            isOptionEqualToValue={(option, value) => option.value === value.value}
            renderInput={(params) => <TextField {...params} label="Unit" size="small" />}
            sx={{ flex: 1, ...accentFieldSx }}
          />
        </Box>
      </Box>

      <Box
        sx={{
          px: { xs: 2.25, md: 2.75 },
          py: 1.5,
          borderTop: `1px solid ${tokens.border.subtle}`,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Button
          onClick={onPrevious}
          disabled={index === 0}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            color: tokens.text.secondary,
            border: `1px solid ${tokens.border.subtle}`,
            borderRadius: `${tokens.radius.lg}px`,
            px: 2,
            '&:hover': { bgcolor: 'transparent', color: tokens.text.primary },
            '&.Mui-disabled': { color: tokens.text.muted, borderColor: tokens.border.subtle },
          }}
        >
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!resolved}
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
          {isLast ? 'Complete' : 'Next conflict'}
        </Button>
      </Box>
    </Box>
  );
}

/**
 * Resolve conflicting units when importing meal-plan items. Bottom sheet on
 * mobile, centered dialog on desktop. The conversion/merge logic stays on the
 * page — this component only renders the current conflict and forwards the
 * quantity/unit edits and the Back/Next stepper callbacks.
 */
export function UnitConflictDialog(props: UnitConflictDialogProps) {
  const { open } = props;
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const body = <Body {...props} sheet={!isDesktop} />;

  if (isDesktop) {
    return (
      <Dialog
        open={open}
        onClose={() => {}}
        maxWidth="sm"
        slotProps={{
          paper: {
            sx: {
              width: { sm: 560 },
              maxWidth: { sm: 560 },
              bgcolor: tokens.surface.raised,
              border: `1px solid ${tokens.border.strong}`,
              borderRadius: `${tokens.radius.xxxl}px`,
              boxShadow: tokens.shadow.modal,
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
      onClose={() => {}}
      slotProps={{
        paper: {
          sx: {
            bgcolor: tokens.surface.sheet,
            borderTopLeftRadius: tokens.radius.sheet,
            borderTopRightRadius: tokens.radius.sheet,
            boxShadow: tokens.shadow.sheet,
            maxHeight: '92%',
          },
        },
      }}
    >
      {body}
    </Drawer>
  );
}
