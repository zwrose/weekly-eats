import { createTheme, ThemeOptions } from '@mui/material/styles';

// Define your theme options
const createThemeOptions = (mode: 'light' | 'dark'): ThemeOptions => ({
  palette: {
    mode,
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#dc004e',
      light: '#ff5983',
      dark: '#9a0036',
      contrastText: '#ffffff',
    },
    background: {
      default: mode === 'light' ? '#f5f5f5' : '#121212',
      paper: mode === 'light' ? '#ffffff' : '#1e1e1e',
    },
    text: {
      primary: mode === 'light' ? '#212121' : '#ffffff',
      secondary: mode === 'light' ? '#757575' : '#b0b0b0',
    },
  },
  typography: {
    fontFamily: '"Figtree", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 500,
      lineHeight: 1.4,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 500,
      lineHeight: 1.4,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.4,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
      fontWeight: 400,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
      fontWeight: 400,
    },
    button: {
      textTransform: 'none',
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
          borderRadius: '24px',
          textTransform: 'none',
          fontWeight: 500,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          },
        },
        contained: {
          '&:hover': {
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: mode === 'light' 
            ? '0 2px 8px rgba(0,0,0,0.1)' 
            : '0 2px 8px rgba(0,0,0,0.3)',
          borderRadius: 12,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: mode === 'light' 
            ? '0 1px 3px rgba(0,0,0,0.1)' 
            : '0 1px 3px rgba(0,0,0,0.3)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

// Create and export themes
export const lightTheme = createTheme(createThemeOptions('light'));
export const darkTheme = createTheme(createThemeOptions('dark'));

// Export theme options for potential customization
export { createThemeOptions }; 

// Reusable responsive dialog styling for full-screen mobile experience
export const responsiveDialogStyle = {
  '& .MuiDialog-paper': {
    margin: { xs: 0, sm: 'auto', md: 'auto', lg: 'auto', xl: 'auto' },
    width: { xs: '100%' },
    height: { xs: '100%', sm: 'auto', md: 'auto', lg: 'auto', xl: 'auto' },
    maxHeight: { xs: '100%', sm: '90vh', md: '90vh', lg: '90vh', xl: '90vh' }
  }
}; 