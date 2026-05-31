// src/components/recipes/RecipeInstructionsView.tsx
'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Box, Typography, Link } from '@mui/material';
import { tokens } from '@/lib/design-tokens';

export function RecipeInstructionsView({ instructions }: { instructions: string }) {
  return (
    <Box sx={{ color: tokens.text.primary, fontSize: 15, lineHeight: 1.65 }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <Typography variant="h6" sx={{ color: tokens.text.primary, mt: 2, mb: 1 }}>
              {children}
            </Typography>
          ),
          h2: ({ children }) => (
            <Typography variant="subtitle1" sx={{ color: tokens.text.primary, mt: 2, mb: 1 }}>
              {children}
            </Typography>
          ),
          h3: ({ children }) => (
            <Typography variant="subtitle2" sx={{ color: tokens.text.primary, mt: 1.5, mb: 0.75 }}>
              {children}
            </Typography>
          ),
          p: ({ children }) => (
            <Typography sx={{ color: tokens.text.primary, mb: 1.25, lineHeight: 1.65 }}>
              {children}
            </Typography>
          ),
          ul: ({ children }) => (
            <Box component="ul" sx={{ pl: 3, mb: 1.25 }}>
              {children}
            </Box>
          ),
          ol: ({ children }) => (
            <Box component="ol" sx={{ pl: 3, mb: 1.25 }}>
              {children}
            </Box>
          ),
          li: ({ children }) => (
            <Box component="li" sx={{ color: tokens.text.primary, mb: 0.5 }}>
              {children}
            </Box>
          ),
          a: ({ href, children }) => (
            <Link
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: 'primary.main' }}
            >
              {children}
            </Link>
          ),
          code: ({ children }) => (
            <Box
              component="code"
              sx={{
                bgcolor: tokens.surface.elevated,
                color: tokens.text.primary,
                px: 0.75,
                py: 0.25,
                borderRadius: `${tokens.radius.sm}px`,
                fontSize: '0.9em',
              }}
            >
              {children}
            </Box>
          ),
          blockquote: ({ children }) => (
            <Box
              sx={{
                borderLeft: `3px solid ${tokens.border.strong}`,
                pl: 2,
                color: tokens.text.secondary,
                my: 1.5,
              }}
            >
              {children}
            </Box>
          ),
        }}
      >
        {instructions}
      </ReactMarkdown>
    </Box>
  );
}
