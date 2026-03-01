'use client';

import React from 'react';
import { Box, Select, Typography } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import type { SxProps, Theme } from '@mui/material/styles';

interface CompactSelectProps {
  label?: string;
  value: string;
  onChange: (e: SelectChangeEvent) => void;
  children: React.ReactNode;
  fullWidth?: boolean;
  sx?: SxProps<Theme>;
  displayEmpty?: boolean;
  renderValue?: (value: string) => React.ReactNode;
}

export const CompactSelect: React.FC<CompactSelectProps> = React.memo(
  function CompactSelect({
    label,
    value,
    onChange,
    children,
    fullWidth = true,
    sx,
    displayEmpty = false,
    renderValue,
  }) {
    return (
      <Box
        data-testid="compact-select-root"
        sx={{ width: fullWidth ? '100%' : 'auto', ...sx as object }}
      >
        {label && (
          <Typography
            data-testid="compact-select-label"
            sx={{
              fontSize: 12,
              fontWeight: 500,
              color: 'text.secondary',
              mb: 0.5,
            }}
          >
            {label}
          </Typography>
        )}
        <Select
          value={value}
          onChange={onChange}
          displayEmpty={displayEmpty}
          renderValue={renderValue as ((value: string) => React.ReactNode) | undefined}
          fullWidth={fullWidth}
          variant="standard"
          disableUnderline
          sx={{
            height: 32,
            fontSize: '0.875rem',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '6px',
            px: 1.25,
            '&:hover': {
              borderColor: 'rgba(255,255,255,0.16)',
            },
            '&.Mui-focused': {
              borderColor: 'primary.main',
              boxShadow: (theme: Theme) =>
                `0 0 0 2px ${theme.palette.primary.main}26`,
            },
            '& .MuiSelect-select': {
              padding: '0 !important',
              paddingRight: '24px !important',
              display: 'flex',
              alignItems: 'center',
              height: '100%',
            },
            // Remove default underline from standard variant
            '&::before, &::after': {
              display: 'none',
            },
          }}
        >
          {children}
        </Select>
      </Box>
    );
  },
);
