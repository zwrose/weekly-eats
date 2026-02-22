/**
 * Reusable Quantity Input component
 *
 * Uses the useQuantityInput hook for consistent validation and behavior.
 */

'use client';

import { TextField, SxProps, Theme } from '@mui/material';
import { useQuantityInput } from '@/lib/hooks/use-quantity-input';

export interface QuantityInputProps {
  value: number;
  onChange: (quantity: number) => void;
  label?: string;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  disabled?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  sx?: SxProps<Theme>;
}

export default function QuantityInput({
  value,
  onChange,
  label = 'Quantity',
  size = 'small',
  fullWidth = false,
  disabled = false,
  inputRef,
  sx,
}: QuantityInputProps) {
  const quantity = useQuantityInput({
    initialQuantity: value,
    onQuantityChange: onChange,
  });

  return (
    <TextField
      label={label}
      type="number"
      value={quantity.displayValue}
      onChange={(e) => quantity.handleChange(e.target.value)}
      error={quantity.error}
      helperText={quantity.errorMessage}
      size={size}
      fullWidth={fullWidth}
      disabled={disabled}
      inputRef={inputRef}
      slotProps={{
        htmlInput: {
          min: 0,
          step: 0.01,
        },
      }}
      sx={sx}
    />
  );
}
