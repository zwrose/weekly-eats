'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  TextField,
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  Box,
  Typography,
  Alert,
  Autocomplete,
  Checkbox,
} from '@mui/material';
import { getUnitOptions } from '../lib/food-items-utils';
import pluralize from '@wei/pluralize';
import { DialogActions, DialogTitle } from './ui';
import { responsiveDialogStyle } from '../lib/theme';

interface AddFoodItemDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (foodItem: {
    name: string;
    singularName: string;
    pluralName: string;
    unit: string;
    isGlobal: boolean;
    addToPantry: boolean;
  }) => void | Promise<void>;
  prefillName?: string;
}

export default function AddFoodItemDialog({
  open,
  onClose,
  onAdd,
  prefillName = '',
}: AddFoodItemDialogProps) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<string | null>(null);
  const [isGlobal, setIsGlobal] = useState(true);
  const [addToPantry, setAddToPantry] = useState(false);
  const [error, setError] = useState('');
  const [singularName, setSingularName] = useState('');
  const [pluralName, setPluralName] = useState('');

  // Update name when prefillName changes or dialog opens
  useEffect(() => {
    if (open) {
      setName(prefillName);
      setUnit(null);
      setIsGlobal(true);
      setAddToPantry(false);
      setError('');
      setSingularName('');
      setPluralName('');
    }
  }, [open, prefillName]);

  // Calculate singular/plural names when name changes and unit is "each"
  useEffect(() => {
    if (unit === 'each' && name.trim()) {
      const trimmedName = name.trim();
      const isInputSingular = pluralize.isSingular(trimmedName);
      const calculatedSingular = isInputSingular ? trimmedName : pluralize.singular(trimmedName);
      const calculatedPlural = isInputSingular ? pluralize.plural(trimmedName) : trimmedName;

      setSingularName(calculatedSingular);
      setPluralName(calculatedPlural);
    } else if (unit !== 'each') {
      // Clear singular/plural when switching away from "each"
      setSingularName('');
      setPluralName('');
    }
  }, [name, unit]);

  const handleSubmit = async () => {
    // Validate required fields
    if (!name.trim()) {
      setError('Food item name is required');
      return;
    }
    if (!unit) {
      setError('Unit is required');
      return;
    }

    // If unit is "each", validate singular/plural names
    if (unit === 'each' && (!singularName.trim() || !pluralName.trim())) {
      setError('Both singular and plural names are required');
      return;
    }

    // Build payload
    const payload =
      unit === 'each'
        ? {
            name: singularName.trim(),
            singularName: singularName.trim(),
            pluralName: pluralName.trim(),
            unit,
            isGlobal,
            addToPantry,
          }
        : {
            name: name.trim(),
            singularName: name.trim(),
            pluralName: name.trim(),
            unit,
            isGlobal,
            addToPantry,
          };

    try {
      await onAdd(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add food item');
      return;
    }

    // Reset form on success
    setName('');
    setUnit(null);
    setIsGlobal(true);
    setAddToPantry(false);
    setError('');
    setSingularName('');
    setPluralName('');
  };

  const handleClose = () => {
    // Reset form
    setName('');
    setUnit(null);
    setIsGlobal(true);
    setAddToPantry(false);
    setError('');
    setSingularName('');
    setPluralName('');
    onClose();
  };

  const isEachUnit = unit === 'each';

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      sx={responsiveDialogStyle}
      TransitionProps={{
        onEntered: () => {
          const input = document.querySelector<HTMLInputElement>(
            '.MuiDialog-root input[type="text"]'
          );
          input?.focus();
        },
      }}
    >
      <DialogTitle onClose={handleClose}>Add New Food Item</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 0.5 }}>
            {error}
          </Alert>
        )}

        <TextField
          label="Default Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          required
          autoFocus
          helperText={
            isEachUnit
              ? 'Enter the name as you would normally say it (e.g., &apos;apples&apos; or &apos;apple&apos;)'
              : 'Enter the name of the food item'
          }
        />

        <Autocomplete
          options={getUnitOptions()}
          value={getUnitOptions().find((option) => option.value === unit) ?? null}
          onChange={(_, newValue) => setUnit(newValue?.value ?? null)}
          getOptionLabel={(option) => option.label}
          isOptionEqualToValue={(option, value) => option.value === value.value}
          clearOnBlur={false}
          autoHighlight
          fullWidth
          renderInput={(params) => (
            <TextField {...params} label="Typical Usage Unit" required />
          )}
        />

        {/* Show singular/plural fields only when "each" unit is selected */}
        {isEachUnit && (
          <>
            <TextField
              label="Singular Name"
              value={singularName}
              onChange={(e) => setSingularName(e.target.value)}
              fullWidth
              required
              helperText="Used when referring to 1 item (e.g., '1 apple')"
            />

            <TextField
              label="Plural Name"
              value={pluralName}
              onChange={(e) => setPluralName(e.target.value)}
              fullWidth
              required
              helperText="Used when referring to multiple items (e.g., '2 apples')"
            />
          </>
        )}

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Access Level
          </Typography>
          <RadioGroup value={isGlobal} onChange={(e) => setIsGlobal(e.target.value === 'true')}>
            <FormControlLabel
              value={true}
              control={<Radio />}
              label="Global (visible to all users)"
            />
            <FormControlLabel
              value={false}
              control={<Radio />}
              label="Personal (only visible to you)"
            />
          </RadioGroup>
        </Box>

        <FormControlLabel
          control={
            <Checkbox
              checked={addToPantry}
              onChange={(e) => setAddToPantry(e.target.checked)}
            />
          }
          label="Also add to my pantry list"
        />
      </DialogContent>
      <DialogActions primaryButtonIndex={1}>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={
            !name.trim() ||
            !unit ||
            (isEachUnit && (!singularName.trim() || !pluralName.trim()))
          }
        >
          Add Food Item
        </Button>
      </DialogActions>
    </Dialog>
  );
}
