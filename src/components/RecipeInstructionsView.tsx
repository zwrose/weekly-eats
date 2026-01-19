"use client";

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Typography, Box, Link as MuiLink, Divider } from '@mui/material';
import { Components } from 'react-markdown';

interface RecipeInstructionsViewProps {
  instructions: string;
}

const RecipeInstructionsView: React.FC<RecipeInstructionsViewProps> = ({ instructions }) => {
  // Custom components for react-markdown to use MUI Typography
  const components: Partial<Components> = {
    // Headings
    h1: ({ ...props }) => <Typography variant="h4" component="h1" gutterBottom sx={{ mt: 3, mb: 2 }} {...props} />,
    h2: ({ ...props }) => <Typography variant="h5" component="h2" gutterBottom sx={{ mt: 2.5, mb: 1.5 }} {...props} />,
    h3: ({ ...props }) => <Typography variant="h6" component="h3" gutterBottom sx={{ mt: 2, mb: 1 }} {...props} />,
    h4: ({ ...props }) => <Typography variant="h6" component="h4" gutterBottom sx={{ mt: 1.5, mb: 0.5, fontWeight: 600 }} {...props} />,
    h5: ({ ...props }) => <Typography variant="body1" component="h5" gutterBottom sx={{ mt: 1.5, mb: 0.5, fontWeight: 600 }} {...props} />,
    h6: ({ ...props }) => <Typography variant="body1" component="h6" gutterBottom sx={{ mt: 1.5, mb: 0.5, fontWeight: 500 }} {...props} />,
    
    // Paragraphs
    p: ({ ...props }) => <Typography variant="body1" component="p" paragraph {...props} />,
    
    // Lists
    ul: ({ ...props }) => (
      <Box component="ul" sx={{ pl: 3, mb: 2, '& li': { mb: 0.5 } }} {...props} />
    ),
    ol: ({ ...props }) => (
      <Box component="ol" sx={{ pl: 3, mb: 2, '& li': { mb: 0.5 } }} {...props} />
    ),
    li: ({ ...props }) => <Box component="li" sx={{ mb: 0.5 }} {...props} />,
    
    // Links
    a: ({ href, children, ...props }) => (
      <MuiLink href={href} target="_blank" rel="noopener noreferrer" color="primary" {...props}>
        {children}
      </MuiLink>
    ),
    
    // Code blocks
    code: ({ inline, children, ...props }: { inline?: boolean; children?: React.ReactNode; className?: string }) => {
      if (inline) {
        return (
          <Box
            component="code"
            sx={{
              bgcolor: 'action.hover',
              px: 0.5,
              py: 0.25,
              borderRadius: 0.5,
              fontFamily: 'monospace',
              fontSize: '0.875em',
            }}
            {...props}
          >
            {children}
          </Box>
        );
      }
      
      return (
        <Box
          component="pre"
          sx={{
            bgcolor: 'action.hover',
            p: 2,
            borderRadius: 1,
            overflow: 'auto',
            mb: 2,
            '& code': {
              fontFamily: 'monospace',
              fontSize: '0.875em',
            },
          }}
          {...props}
        >
          <Box component="code" sx={{ fontFamily: 'monospace', fontSize: '0.875em' }}>
            {children}
          </Box>
        </Box>
      );
    },
    
    // Blockquotes
    blockquote: ({ ...props }) => (
      <Box
        component="blockquote"
        sx={{
          borderLeft: 3,
          borderColor: 'primary.main',
          pl: 2,
          ml: 0,
          mr: 0,
          mb: 2,
          fontStyle: 'italic',
          color: 'text.secondary',
        }}
        {...props}
      />
    ),
    
    // Horizontal rules
    hr: ({ ...props }) => <Divider sx={{ my: 3 }} {...props} />,
    
    // Tables (from remark-gfm)
    table: ({ ...props }) => (
      <Box
        component="table"
        sx={{
          borderCollapse: 'collapse',
          width: '100%',
          mb: 2,
          '& th, & td': {
            border: 1,
            borderColor: 'divider',
            px: 1.5,
            py: 1,
            textAlign: 'left',
          },
          '& th': {
            bgcolor: 'action.hover',
            fontWeight: 600,
          },
        }}
        {...props}
      />
    ),
    thead: ({ ...props }) => <Box component="thead" {...props} />,
    tbody: ({ ...props }) => <Box component="tbody" {...props} />,
    tr: ({ ...props }) => <Box component="tr" {...props} />,
    th: ({ ...props }) => <Box component="th" {...props} />,
    td: ({ ...props }) => <Box component="td" {...props} />,
  };

  if (!instructions || !instructions.trim()) {
    return (
      <Typography variant="body1" color="text.secondary" sx={{ fontStyle: 'italic' }}>
        No instructions provided.
      </Typography>
    );
  }

  return (
    <Box sx={{ '& > *:first-of-type': { mt: 0 } }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {instructions}
      </ReactMarkdown>
    </Box>
  );
};

export default RecipeInstructionsView;

