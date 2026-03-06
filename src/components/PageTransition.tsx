import { memo } from 'react';
import { Box } from '@mui/material';

interface PageTransitionProps {
  children: React.ReactNode;
}

export const PageTransition = memo(function PageTransition({ children }: PageTransitionProps) {
  return (
    <Box
      sx={{
        '@media (prefers-reduced-motion: no-preference)': {
          animation: 'fadeInUp var(--duration-normal) var(--ease-out) forwards',
        },
        '@media (prefers-reduced-motion: reduce)': {
          opacity: 1,
        },
      }}
    >
      {children}
    </Box>
  );
});
