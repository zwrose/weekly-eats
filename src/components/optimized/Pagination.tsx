import React from 'react';
import { Box, Pagination as MuiPagination } from '@mui/material';

interface PaginationProps {
  count: number;
  page: number;
  onChange: (page: number) => void;
  show?: boolean;
}

const Pagination = React.memo<PaginationProps>(({ 
  count, 
  page, 
  onChange, 
  show = true 
}) => {
  if (!show || count <= 1) return null;

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
      <MuiPagination
        count={count}
        page={page}
        onChange={(_, newPage) => onChange(newPage)}
        color="primary"
      />
    </Box>
  );
});

Pagination.displayName = 'Pagination';

export default Pagination; 