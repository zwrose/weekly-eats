/**
 * Reusable Unit Selector component
 * 
 * Displays unit options with proper singular/plural forms based on quantity.
 */

"use client";

import { Autocomplete, TextField, SxProps, Theme } from '@mui/material';
import { getUnitOptions, getUnitForm } from '@/lib/food-items-utils';

export interface UnitSelectorProps {
  value: string;
  quantity: number;
  onChange: (unit: string) => void;
  label?: string;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  disabled?: boolean;
  sx?: SxProps<Theme>;
}

export default function UnitSelector({
  value,
  quantity,
  onChange,
  label = 'Unit',
  size = 'small',
  fullWidth = false,
  disabled = false,
  sx,
}: UnitSelectorProps) {
  const unitOptions = getUnitOptions();
  const selectedOption = unitOptions.find(option => option.value === value);

  return (
    <Autocomplete
      key={`unit-${value}-${quantity}`} // Force re-render when quantity changes
      options={unitOptions}
      value={selectedOption ?? undefined}
      onChange={(_, newValue) => onChange(newValue?.value || 'cup')}
      getOptionLabel={(option) => getUnitForm(option.value, quantity)}
      isOptionEqualToValue={(option, value) => option.value === value.value}
      disableClearable={true}
      fullWidth={fullWidth}
      disabled={disabled}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          size={size}
        />
      )}
      sx={sx}
    />
  );
}

