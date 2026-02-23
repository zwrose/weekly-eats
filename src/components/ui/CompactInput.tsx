'use client';

import React from 'react';
import { Box, InputBase, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

interface CompactInputProps {
  label?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  fullWidth?: boolean;
  sx?: SxProps<Theme>;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  autoComplete?: string;
  name?: string;
  multiline?: boolean;
  rows?: number;
  error?: boolean;
  helperText?: string;
}

export const CompactInput: React.FC<CompactInputProps> = React.memo(
  function CompactInput({
    label,
    value,
    onChange,
    placeholder,
    type = 'text',
    required = false,
    fullWidth = true,
    sx,
    inputProps,
    autoComplete,
    name,
    multiline = false,
    rows,
    error = false,
    helperText,
  }) {
    return (
      <Box
        data-testid="compact-input-root"
        sx={{ width: fullWidth ? '100%' : 'auto', ...sx as object }}
      >
        {label && (
          <Typography
            data-testid="compact-input-label"
            sx={{
              fontSize: 12,
              fontWeight: 500,
              color: error ? 'error.main' : 'text.secondary',
              mb: 0.5,
            }}
          >
            {label}
            {required && (
              <Typography
                component="span"
                sx={{ color: 'error.main', ml: 0.25 }}
              >
                *
              </Typography>
            )}
          </Typography>
        )}
        <InputBase
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          type={type}
          name={name}
          autoComplete={autoComplete}
          multiline={multiline}
          rows={rows}
          fullWidth={fullWidth}
          inputProps={inputProps}
          sx={{
            height: multiline ? 'auto' : 32,
            fontSize: '0.875rem',
            px: 1.25,
            border: '1px solid',
            borderColor: error ? 'error.main' : 'divider',
            borderRadius: '6px',
            '&:hover': {
              borderColor: error ? 'error.main' : 'rgba(255,255,255,0.16)',
            },
            '&.Mui-focused': {
              borderColor: 'primary.main',
              boxShadow: (theme: Theme) =>
                `0 0 0 2px ${theme.palette.primary.main}26`,
            },
            '& .MuiInputBase-input': {
              padding: 0,
            },
          }}
        />
        {helperText && (
          <Typography
            sx={{
              fontSize: 12,
              color: error ? 'error.main' : 'text.secondary',
              mt: 0.5,
            }}
          >
            {helperText}
          </Typography>
        )}
      </Box>
    );
  },
);
