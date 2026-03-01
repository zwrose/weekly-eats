'use client';

import React, { useState, useCallback, useId } from 'react';
import { Box, Typography } from '@mui/material';
import { ChevronRight } from '@mui/icons-material';
import type { SxProps, Theme } from '@mui/material/styles';

interface CollapsibleSectionProps {
  title: React.ReactNode;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  rightContent?: React.ReactNode;
  sx?: SxProps<Theme>;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = React.memo(
  function CollapsibleSection({
    title,
    defaultExpanded = false,
    children,
    rightContent,
    sx,
  }) {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const contentId = useId();
    const headerId = useId();

    const handleToggle = useCallback(() => {
      setExpanded((prev) => !prev);
    }, []);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleToggle();
        }
      },
      [handleToggle],
    );

    return (
      <Box sx={sx}>
        {/* Header */}
        <Box
          id={headerId}
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          data-testid="collapsible-header"
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: 1.5,
            py: 1,
            cursor: 'pointer',
            borderBottom: '1px solid',
            borderBottomColor: 'divider',
            userSelect: 'none',
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          }}
        >
          <ChevronRight
            data-testid="collapsible-chevron"
            sx={{
              fontSize: 18,
              mr: 0.75,
              transition: 'transform var(--duration-normal)',
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              '@media (prefers-reduced-motion: reduce)': {
                transition: 'none',
              },
            }}
          />
          <Typography
            variant="h5"
            component="span"
            sx={{ flex: 1, lineHeight: 1.4 }}
          >
            {title}
          </Typography>
          {rightContent && (
            <Box
              data-testid="collapsible-right-content"
              sx={{ ml: 1 }}
            >
              {rightContent}
            </Box>
          )}
        </Box>

        {/* Content area: CSS grid animation for smooth height transition */}
        <Box
          id={contentId}
          role="region"
          aria-labelledby={headerId}
          data-testid="collapsible-content"
          sx={{
            display: 'grid',
            gridTemplateRows: expanded ? '1fr' : '0fr',
            transition:
              'grid-template-rows var(--duration-normal), opacity var(--duration-normal)',
            opacity: expanded ? 1 : 0,
            '@media (prefers-reduced-motion: reduce)': {
              transition: 'none',
            },
          }}
        >
          <Box sx={{ overflow: 'hidden' }}>{children}</Box>
        </Box>
      </Box>
    );
  },
);
