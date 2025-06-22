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
} from '@mui/material';
import { VALID_UNITS } from '../lib/food-items-utils';

interface AddFoodItemDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (foodItem: { name: string; unit: string; isGlobal: boolean }) => void;
  prefillName?: string;
}

export default function AddFoodItemDialog({ open, onClose, onAdd, prefillName = '' }: AddFoodItemDialogProps) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('each');
  const [isGlobal, setIsGlobal] = useState(false);
  const [error, setError] = useState('');

  // Update name when prefillName changes or dialog opens
  useEffect(() => {
    if (open) {
      setName(prefillName);
      setUnit('each');
      setIsGlobal(false);
      setError('');
    }
  }, [open, prefillName]);

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('Food item name is required');
      return;
    }
    if (!unit) {
      setError('Unit is required');
      return;
    }

    onAdd({
      name: name.trim(),
      unit,
      isGlobal
    });

    // Reset form
    setName('');
    setUnit('each');
    setIsGlobal(false);
    setError('');
  };

  const handleClose = () => {
    // Reset form
    setName('');
    setUnit('each');
    setIsGlobal(false);
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add New Food Item</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            label="Food Item Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            margin="normal"
            required
            autoFocus
          />

          <FormControl fullWidth margin="normal" required>
            <InputLabel>Typical Selling Unit</InputLabel>
            <Select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              label="Typical Selling Unit"
            >
              {VALID_UNITS.map((unitOption) => (
                <MenuItem key={unitOption} value={unitOption}>
                  {unitOption}
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
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained">
          Add Food Item
        </Button>
      </DialogActions>
    </Dialog>
  );
} 