import { createTheme, ThemeOptions } from '@mui/material/styles';

// Linear-style dense, polished aesthetic
const createThemeOptions = (mode: 'light' | 'dark'): ThemeOptions => {
  const isDark = mode === 'dark';

  return {
    palette: {
      mode,
      primary: {
        main: '#5b9bd5',
        light: isDark ? '#7db3e0' : '#7db3e0',
        dark: isDark ? '#4a87bd' : '#4a87bd',
        contrastText: '#ffffff',
      },
      secondary: {
        main: '#d4915e',
        light: isDark ? '#e0a87a' : '#e0a87a',
        dark: isDark ? '#b87a4a' : '#b87a4a',
        contrastText: '#ffffff',
      },
      background: {
        default: isDark ? '#0a0a0b' : '#fafafa',
        paper: isDark ? '#141415' : '#ffffff',
      },
      text: {
        primary: isDark ? '#ececec' : '#1a1a1a',
        secondary: isDark ? '#8a8a8a' : '#6b6b6b',
        disabled: isDark ? '#5a5a5a' : '#9e9e9e',
      },
      divider: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
      error: {
        main: isDark ? '#e57373' : '#d32f2f',
      },
      warning: {
        main: isDark ? '#ffb74d' : '#ed6c02',
      },
      success: {
        main: isDark ? '#81c784' : '#2e7d32',
      },
      info: {
        main: '#5b9bd5',
      },
      action: {
        hover: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
        selected: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      },
    },
    typography: {
      fontFamily: '"Figtree", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: {
        fontSize: '1.5rem',
        fontWeight: 600,
        lineHeight: 1.3,
      },
      h2: {
        fontSize: '1.25rem',
        fontWeight: 600,
        lineHeight: 1.3,
      },
      h3: {
        fontSize: '1.125rem',
        fontWeight: 600,
        lineHeight: 1.4,
      },
      h4: {
        fontSize: '1rem',
        fontWeight: 500,
        lineHeight: 1.4,
      },
      h5: {
        fontSize: '0.875rem',
        fontWeight: 600,
        lineHeight: 1.4,
      },
      h6: {
        fontSize: '0.8125rem',
        fontWeight: 600,
        lineHeight: 1.4,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.04em',
      },
      body1: {
        fontSize: '0.875rem',
        lineHeight: 1.5,
        fontWeight: 400,
      },
      body2: {
        fontSize: '0.8125rem',
        lineHeight: 1.5,
        fontWeight: 400,
      },
      caption: {
        fontSize: '0.75rem',
        lineHeight: 1.4,
        fontWeight: 400,
      },
      button: {
        fontSize: '0.8125rem',
        textTransform: 'none' as const,
        fontWeight: 500,
      },
    },
    shape: {
      borderRadius: 8,
    },
    spacing: 8,
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.8125rem',
            boxShadow: 'none',
            minHeight: 32,
            padding: '4px 12px',
            '&:hover': {
              boxShadow: 'none',
            },
          },
          contained: {
            '&:hover': {
              boxShadow: 'none',
            },
          },
          sizeSmall: {
            minHeight: 28,
            padding: '2px 8px',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: 'none',
            borderRadius: 8,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderRadius: 8,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: 'none',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            fontSize: '0.875rem',
          },
          input: {
            padding: '6px 10px',
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          size: 'small',
        },
      },
    },
  };
};

// Create and export themes
export const lightTheme = createTheme(createThemeOptions('light'));
export const darkTheme = createTheme(createThemeOptions('dark'));

// Reusable responsive dialog styling for full-screen mobile experience
export const responsiveDialogStyle = {
  '& .MuiDialog-paper': {
    margin: { xs: 0, sm: 2 },
    width: { xs: '100%', sm: 'auto' },
    height: { xs: '100%', sm: 'auto' },
    maxHeight: { xs: '100%', sm: '85vh' },
    maxWidth: { xs: '100%', sm: 600 },
    borderRadius: { xs: 0, sm: 2 },
  },
};
