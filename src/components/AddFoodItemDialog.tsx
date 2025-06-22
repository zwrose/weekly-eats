"use client";

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Radio,
  RadioGroup,
  Box,
  Typography,
  Alert,
  Divider,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import { getUnitOptions } from '../lib/food-items-utils';
import pluralize from '@wei/pluralize';

interface AddFoodItemDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (foodItem: { name: string; singularName: string; pluralName: string; unit: string; isGlobal: boolean }) => void;
  prefillName?: string;
}

export default function AddFoodItemDialog({ open, onClose, onAdd, prefillName = '' }: AddFoodItemDialogProps) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('each');
  const [isGlobal, setIsGlobal] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [singularName, setSingularName] = useState('');
  const [pluralName, setPluralName] = useState('');
  const [originalName, setOriginalName] = useState('');

  // Update name when prefillName changes or dialog opens
  useEffect(() => {
    if (open) {
      setName(prefillName);
      setUnit('each');
      setIsGlobal(false);
      setError('');
      setStep(0);
    }
  }, [open, prefillName]);

  const calculateNames = () => {
    const trimmedName = name.trim();
    const isInputSingular = pluralize.isSingular(trimmedName);
    const calculatedSingular = isInputSingular ? trimmedName : pluralize.singular(trimmedName);
    const calculatedPlural = isInputSingular ? pluralize.plural(trimmedName) : trimmedName;
    
    setSingularName(calculatedSingular);
    setPluralName(calculatedPlural);
  };

  const handleNext = () => {
    if (!name.trim()) {
      setError('Food item name is required');
      return;
    }
    if (!unit) {
      setError('Unit is required');
      return;
    }

    setOriginalName(name.trim());
    calculateNames();
    setStep(1);
    setError('');
  };

  const handleBack = () => {
    setStep(0);
  };

  const handleSubmit = () => {
    if (!singularName.trim() || !pluralName.trim()) {
      setError('Both singular and plural names are required');
      return;
    }

    onAdd({
      name: singularName.trim(),
      singularName: singularName.trim(),
      pluralName: pluralName.trim(),
      unit,
      isGlobal
    });

    // Reset form
    setName('');
    setUnit('each');
    setIsGlobal(false);
    setError('');
    setStep(0);
    setSingularName('');
    setPluralName('');
    setOriginalName('');
  };

  const handleClose = () => {
    // Reset form
    setName('');
    setUnit('each');
    setIsGlobal(false);
    setError('');
    setStep(0);
    setSingularName('');
    setPluralName('');
    setOriginalName('');
    onClose();
  };

  const steps = ['Basic Information', 'Confirm Names'];

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Add New Food Item
          </Typography>
          <Stepper activeStep={step} sx={{ mt: 2 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {step === 0 ? (
            // Step 1: Basic Information
            <Box>
              <TextField
                label="Default Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                margin="normal"
                required
                autoFocus
                helperText="Enter the name as you would normally say it (e.g., &apos;apples&apos; or &apos;apple&apos;)"
              />

              <FormControl fullWidth margin="normal" required>
                <InputLabel>Typical Selling Unit</InputLabel>
                <Select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  label="Typical Selling Unit"
                >
                  {getUnitOptions().map((unitOption) => (
                    <MenuItem key={unitOption.value} value={unitOption.value}>
                      {unitOption.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Scope
                </Typography>
                <RadioGroup
                  value={isGlobal}
                  onChange={(e) => setIsGlobal(e.target.value === 'true')}
                >
                  <FormControlLabel
                    value={false}
                    control={<Radio />}
                    label="Personal (only visible to you)"
                  />
                  <FormControlLabel
                    value={true}
                    control={<Radio />}
                    label="Global (visible to all users)"
                  />
                </RadioGroup>
              </Box>
            </Box>
          ) : (
            // Step 2: Confirm Names
            <Box>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                We&apos;ve calculated the singular and plural forms of your food item. You can adjust these if needed.
              </Typography>

              <TextField
                label="Singular Name"
                value={singularName}
                onChange={(e) => setSingularName(e.target.value)}
                fullWidth
                margin="normal"
                required
                helperText="Used when referring to 1 item (e.g., &apos;1 apple&apos;)"
              />

              <TextField
                label="Plural Name"
                value={pluralName}
                onChange={(e) => setPluralName(e.target.value)}
                fullWidth
                margin="normal"
                required
                helperText="Used when referring to multiple items (e.g., &apos;2 apples&apos;)"
              />

              <Divider sx={{ my: 3 }} />

              <Typography variant="subtitle2" gutterBottom>
                Food Item To Be Added
              </Typography>
              <Box sx={{ 
                bgcolor: 'background.paper', 
                p: 2, 
                borderRadius: 1, 
                border: '1px solid', 
                borderColor: 'divider',
                boxShadow: 1
              }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Default Name:</strong> {originalName}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Singular Name:</strong> {singularName}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Plural Name:</strong> {pluralName}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Typical Selling Unit:</strong> {unit}
                </Typography>
                <Typography variant="body2">
                  <strong>Scope:</strong> {isGlobal ? 'Global' : 'Personal'}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        {step === 0 ? (
          <Button onClick={handleNext} variant="contained">
            Next
          </Button>
        ) : (
          <>
            <Button onClick={handleBack}>Back</Button>
            <Button onClick={handleSubmit} variant="contained">
              Add Food Item
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
} 