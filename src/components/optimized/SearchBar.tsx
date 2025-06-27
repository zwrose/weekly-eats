import React from 'react';
import { TextField, Box } from '@mui/material';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  fullWidth?: boolean;
}

const SearchBar = React.memo<SearchBarProps>(({ 
  value, 
  onChange, 
  placeholder = "Start typing to search...",
  fullWidth = true 
}) => {
  return (
    <Box sx={{ mb: 4 }}>
      <TextField
        fullWidth={fullWidth}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        size="small"
      />
    </Box>
  );
});

SearchBar.displayName = 'SearchBar';

export default SearchBar; 