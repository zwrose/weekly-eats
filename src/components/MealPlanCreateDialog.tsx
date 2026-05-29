'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  FormControl,
  Select,
  MenuItem,
} from '@mui/material';
import { CreateMealPlanRequest, MealPlanTemplate } from '@/types/meal-plan';
import { DEFAULT_TEMPLATE } from '@/lib/meal-plan-utils';
import { parseLocalDate, formatDateForAPI } from '@/lib/date-utils';
import { responsiveDialogStyle } from '@/lib/theme';
import { DialogActions, DialogTitle } from '@/components/ui';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { tokens } from '@/lib/design-tokens';

interface MealPlanOwner {
  userId: string;
  name?: string;
  email: string;
}

export interface MealPlanCreateDialogProps {
  open: boolean;
  onClose: () => void;
  mealPlanOwners: MealPlanOwner[];
  selectedOwner: string | null;
  onSelectedOwnerChange: (owner: string) => void;
  currentUserId: string | null | undefined;
  newMealPlan: CreateMealPlanRequest;
  onNewMealPlanChange: (plan: CreateMealPlanRequest) => void;
  validationError: string | null;
  skippedDefault: {
    skipped: boolean;
    skippedFrom?: string;
    earliestAvailable: string | null;
  } | null;
  template: MealPlanTemplate | null;
  onSubmit: () => void;
}

const MealPlanCreateDialog: React.FC<MealPlanCreateDialogProps> = ({
  open,
  onClose,
  mealPlanOwners,
  selectedOwner,
  onSelectedOwnerChange,
  currentUserId,
  newMealPlan,
  onNewMealPlanChange,
  validationError,
  skippedDefault,
  template,
  onSubmit,
}) => {
  const activeTemplate = template || DEFAULT_TEMPLATE;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={responsiveDialogStyle}
      slotProps={{
        paper: {
          sx: {
            bgcolor: tokens.surface.raised,
            borderRadius: `${tokens.radius.xxl}px`,
            border: `1px solid ${tokens.border.strong}`,
          },
        },
      }}
    >
      <DialogTitle onClose={onClose}>
        <Box
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 700,
            color: tokens.text.primary,
            letterSpacing: '-0.01em',
          }}
        >
          New meal plan
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ pt: 2 }}>
          {/* Owner selection if user has shared access */}
          {mealPlanOwners.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  mb: 0.75,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontSize: 10,
                  fontWeight: 700,
                  color: tokens.text.muted,
                }}
              >
                Create For
              </Typography>
              <FormControl fullWidth>
                <Select
                  value={selectedOwner || currentUserId || ''}
                  onChange={(e) => onSelectedOwnerChange(e.target.value)}
                  sx={{
                    bgcolor: tokens.surface.elevated,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: tokens.border.strong,
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: tokens.text.secondary,
                    },
                  }}
                >
                  <MenuItem value={currentUserId || ''}>Your Meal Plans</MenuItem>
                  {mealPlanOwners.map((user) => (
                    <MenuItem key={user.userId} value={user.userId}>
                      {user.name || user.email}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}

          <Box sx={{ mb: 3 }}>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                mb: 0.75,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontSize: 10,
                fontWeight: 700,
                color: tokens.text.muted,
              }}
            >
              Start Date
            </Typography>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label=""
                value={newMealPlan.startDate ? parseLocalDate(newMealPlan.startDate) : null}
                onChange={(date) => {
                  if (date && date instanceof Date && !isNaN(date.getTime())) {
                    const formattedDate = formatDateForAPI(date);
                    onNewMealPlanChange({ startDate: formattedDate });
                  } else {
                    onNewMealPlanChange({ startDate: '' });
                  }
                }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                    error: !!validationError,
                    inputProps: {
                      readOnly: true,
                      inputMode: 'none',
                    },
                    sx: {
                      '& .MuiOutlinedInput-root': {
                        bgcolor: tokens.surface.elevated,
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: tokens.border.strong,
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: tokens.text.secondary,
                        },
                        '&.Mui-error .MuiOutlinedInput-notchedOutline': {
                          borderColor: tokens.state.danger,
                        },
                      },
                    },
                  },
                }}
              />
            </LocalizationProvider>
          </Box>

          {validationError && (
            <Box
              sx={{
                mb: 3,
                px: 2,
                py: 1.25,
                borderRadius: `${tokens.radius.md}px`,
                bgcolor: tokens.state.dangerMuted,
                border: `1px solid ${tokens.state.danger}44`,
                color: tokens.state.danger,
                fontSize: 13,
              }}
            >
              {validationError}
            </Box>
          )}

          {!validationError && newMealPlan.startDate && (
            <Box
              sx={{
                mb: 3,
                px: 2,
                py: 1.25,
                borderRadius: `${tokens.radius.md}px`,
                bgcolor: tokens.state.successMuted,
                border: `1px solid ${tokens.state.success}44`,
                color: tokens.state.success,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              ✓ No overlap. Plan covers {newMealPlan.startDate}.
            </Box>
          )}

          {skippedDefault?.skipped && (
            <Box
              sx={{
                mb: 2,
                px: 2,
                py: 1.25,
                borderRadius: `${tokens.radius.md}px`,
                bgcolor: tokens.state.warnMuted,
                border: `1px solid ${tokens.state.warn}44`,
                color: tokens.state.warn,
                fontSize: 13,
              }}
            >
              The earliest available start date that does not overlap with your existing meal plans
              is <b>{skippedDefault.earliestAvailable}</b>.
            </Box>
          )}

          <Box
            sx={{
              mb: 3,
              p: 2,
              bgcolor: tokens.surface.elevated,
              border: `1px solid ${tokens.border.subtle}`,
              borderRadius: `${tokens.radius.lg}px`,
            }}
          >
            <Typography
              variant="subtitle2"
              gutterBottom
              sx={{ color: tokens.text.secondary, fontSize: 12 }}
            >
              {template ? 'Using your template settings:' : 'Using default template settings:'}
            </Typography>
            <Typography variant="body2" sx={{ color: tokens.text.secondary }}>
              &bull; Starts on{' '}
              {activeTemplate.startDay.charAt(0).toUpperCase() + activeTemplate.startDay.slice(1)}
            </Typography>
            <Typography variant="body2" sx={{ color: tokens.text.secondary }}>
              &bull; Includes:{' '}
              {Object.entries(activeTemplate.meals)
                .filter(([, enabled]) => enabled)
                .map(([meal]) => meal)
                .join(', ')}
            </Typography>
            {!template && (
              <Typography
                variant="body2"
                sx={{ mt: 1, fontStyle: 'italic', color: tokens.text.muted }}
              >
                You can customize these defaults in Template Settings
              </Typography>
            )}
          </Box>
        </Box>

        <DialogActions primaryButtonIndex={1}>
          <Button
            onClick={onClose}
            sx={{ color: tokens.text.primary, width: { xs: '100%', sm: 'auto' } }}
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            variant="contained"
            color="primary"
            disabled={!newMealPlan.startDate || !!validationError}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Create plan
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(MealPlanCreateDialog);
