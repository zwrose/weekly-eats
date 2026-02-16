"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { CreateMealPlanRequest, MealPlanTemplate } from "@/types/meal-plan";
import { DEFAULT_TEMPLATE } from "@/lib/meal-plan-utils";
import { parseLocalDate, formatDateForAPI } from "@/lib/date-utils";
import { responsiveDialogStyle } from "@/lib/theme";
import { DialogActions, DialogTitle } from "@/components/ui";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";

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
    >
      <DialogTitle onClose={onClose}>Create Meal Plan</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          {/* Owner selection if user has shared access */}
          {mealPlanOwners.length > 0 && (
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Create For</InputLabel>
              <Select
                value={selectedOwner || currentUserId || ""}
                onChange={(e) => onSelectedOwnerChange(e.target.value)}
                label="Create For"
              >
                <MenuItem value={currentUserId || ""}>
                  Your Meal Plans
                </MenuItem>
                {mealPlanOwners.map((user) => (
                  <MenuItem key={user.userId} value={user.userId}>
                    {user.name || user.email}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Start Date"
              value={
                newMealPlan.startDate
                  ? parseLocalDate(newMealPlan.startDate)
                  : null
              }
              onChange={(date) => {
                if (
                  date &&
                  date instanceof Date &&
                  !isNaN(date.getTime())
                ) {
                  const formattedDate = formatDateForAPI(date);
                  onNewMealPlanChange({ startDate: formattedDate });
                } else {
                  onNewMealPlanChange({ startDate: "" });
                }
              }}
              slotProps={{
                textField: {
                  fullWidth: true,
                  sx: { mb: 3 },
                  required: true,
                  error: !!validationError,
                  helperText: validationError || "",
                  inputProps: {
                    readOnly: true,
                    inputMode: "none",
                  },
                },
              }}
            />
          </LocalizationProvider>

          {validationError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {validationError}
            </Alert>
          )}

          {skippedDefault?.skipped && (
            <Alert severity="info" sx={{ mb: 2 }}>
              The earliest available start date that does not overlap with
              your existing meal plans is{" "}
              <b>{skippedDefault.earliestAvailable}</b>.
            </Alert>
          )}

          <Box
            sx={{
              mb: 3,
              p: 2,
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
            }}
          >
            <Typography variant="subtitle2" gutterBottom>
              {template
                ? "Using your template settings:"
                : "Using default template settings:"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              &bull; Starts on{" "}
              {activeTemplate.startDay.charAt(0).toUpperCase() +
                activeTemplate.startDay.slice(1)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              &bull; Includes:{" "}
              {Object.entries(activeTemplate.meals)
                .filter(([, enabled]) => enabled)
                .map(([meal]) => meal)
                .join(", ")}
            </Typography>
            {!template && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1, fontStyle: "italic" }}
              >
                You can customize these defaults in Template Settings
              </Typography>
            )}
          </Box>
        </Box>

        <DialogActions primaryButtonIndex={1}>
          <Button
            onClick={onClose}
            sx={{ width: { xs: "100%", sm: "auto" } }}
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            variant="contained"
            disabled={!newMealPlan.startDate || !!validationError}
            sx={{ width: { xs: "100%", sm: "auto" } }}
          >
            Create Plan
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(MealPlanCreateDialog);
