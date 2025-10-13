"use client";

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
  Divider,
  Stepper,
  Step,
  StepLabel,
  Autocomplete,
} from '@mui/material';
import { getUnitOptions } from '../lib/food-items-utils';
import pluralize from '@wei/pluralize';
import { DialogActions, DialogTitle } from './ui';
import { responsiveDialogStyle } from '../lib/theme';

interface AddFoodItemDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (foodItem: { name: string; singularName: string; pluralName: string; unit: string; isGlobal: boolean }) => void;
  prefillName?: string;
}

export default function AddFoodItemDialog({ open, onClose, onAdd, prefillName = '' }: AddFoodItemDialogProps) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('each');
  const [isGlobal, setIsGlobal] = useState(true);
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
      setIsGlobal(true);
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
    setIsGlobal(true);
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
    setIsGlobal(true);
    setError('');
    setStep(0);
    setSingularName('');
    setPluralName('');
    setOriginalName('');
    onClose();
  };

  const steps = ['Basic Information', 'Confirm Names'];

  return (
          <Dialog 
        open={open} 
        onClose={handleClose} 
        maxWidth="md" 
        fullWidth
        sx={responsiveDialogStyle}
      >
      <DialogTitle onClose={handleClose}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Add New Food Item
          </Typography>
          <Stepper 
            activeStep={step} 
            sx={{ mt: 2 }}
          >
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel sx={{ 
                  '& .MuiStepLabel-label': {
                    fontSize: { xs: '0.875rem', sm: '1rem' }
                  }
                }}>
                  {label}
                </StepLabel>
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

              <Autocomplete
                options={getUnitOptions()}
                value={getUnitOptions().find(option => option.value === unit) ?? undefined}
                onChange={(_, newValue) => setUnit(newValue?.value || 'each')}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, value) => option.value === value.value}
                disableClearable
                autoHighlight
                fullWidth
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Typical Selling Unit"
                    margin="normal"
                    required
                  />
                )}
              />

              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Access Level
                </Typography>
                <RadioGroup
                  value={isGlobal}
                  onChange={(e) => setIsGlobal(e.target.value === 'true')}
                >
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
                  <strong>Access Level:</strong> {isGlobal ? 'Global' : 'Personal'}
                </Typography>
              </Box>
            </Box>
          )}

          <DialogActions primaryButtonIndex={step === 0 ? 1 : 2}>
            <Button onClick={handleClose}>
              Cancel
            </Button>
            {step === 0 ? (
              <Button 
                onClick={handleNext} 
                variant="contained"
              >
                Next
              </Button>
            ) : (
              <>
                <Button onClick={handleBack}>
                  Back
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  variant="contained"
                >
                  Add Food Item
                </Button>
              </>
            )}
          </DialogActions>
        </Box>
      </DialogContent>
    </Dialog>
  );
} 