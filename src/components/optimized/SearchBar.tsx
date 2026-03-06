import React from 'react';
import { TextField, InputAdornment } from '@mui/material';
import { Search } from '@mui/icons-material';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  fullWidth?: boolean;
}

const SearchBar = React.memo<SearchBarProps>(
  ({ value, onChange, placeholder = 'Start typing to search...', fullWidth = true }) => {
    return (
      <TextField
        fullWidth={fullWidth}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        size="small"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ fontSize: 18, color: 'text.secondary' }} />
              </InputAdornment>
            ),
            sx: { height: 36 },
          },
        }}
      />
    );
  },
);

SearchBar.displayName = 'SearchBar';

export default SearchBar;
