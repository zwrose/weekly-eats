import { createTheme, ThemeOptions } from '@mui/material/styles';
import { tokens } from './design-tokens';

const display = 'var(--font-display), "Bricolage Grotesque", system-ui, sans-serif';
const body = 'var(--font-body), "Outfit", system-ui, sans-serif';

// Single dark theme for now. Re-adding light later means reintroducing a mode param here and
// branching the token references — the builder shape is intentionally kept as one focused factory.
const createThemeOptions = (): ThemeOptions => ({
  palette: {
    mode: 'dark',
    primary: { main: tokens.section.plans, contrastText: tokens.surface.base },
    secondary: { main: tokens.accentUtility, contrastText: tokens.surface.base },
    background: { default: tokens.surface.base, paper: tokens.surface.raised },
    text: {
      primary: tokens.text.primary,
      secondary: tokens.text.secondary,
      disabled: tokens.text.muted,
    },
    divider: tokens.border.subtle,
    success: { main: tokens.state.success },
    error: { main: tokens.state.danger },
    warning: { main: tokens.state.warn },
    section: { ...tokens.section },
    mealColor: { ...tokens.meal },
    accentUtility: tokens.accentUtility,
  },
  typography: {
    fontFamily: body,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    h1: { fontFamily: display, fontSize: '30px', fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontFamily: display, fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em' },
    h3: { fontFamily: display, fontSize: '18px', fontWeight: 700, letterSpacing: '-0.01em' },
    h4: { fontFamily: display, fontSize: '15px', fontWeight: 700, letterSpacing: '-0.01em' },
    body1: { fontFamily: body, fontSize: '14px', fontWeight: 500 },
    body2: { fontFamily: body, fontSize: '13px', fontWeight: 500 },
    button: { fontFamily: body, fontSize: '14px', fontWeight: 600, textTransform: 'none' },
    displayXl: {
      fontFamily: display,
      fontSize: '32px',
      fontWeight: 700,
      letterSpacing: '-0.025em',
      fontVariantNumeric: 'tabular-nums',
    },
    displayLg: {
      fontFamily: display,
      fontSize: '30px',
      fontWeight: 700,
      letterSpacing: '-0.02em',
      fontVariantNumeric: 'tabular-nums',
    },
    displayMd: {
      fontFamily: display,
      fontSize: '24px',
      fontWeight: 700,
      letterSpacing: '-0.02em',
      fontVariantNumeric: 'tabular-nums',
    },
    displaySm: { fontFamily: display, fontSize: '18px', fontWeight: 700, letterSpacing: '-0.01em' },
    displayXs: { fontFamily: display, fontSize: '15px', fontWeight: 700, letterSpacing: '-0.01em' },
    bodyLg: { fontFamily: body, fontSize: '14px', fontWeight: 500 },
    bodyMd: { fontFamily: body, fontSize: '13px', fontWeight: 500 },
    bodySm: { fontFamily: body, fontSize: '12px', fontWeight: 400 },
    bodyXs: { fontFamily: body, fontSize: '11px', fontWeight: 400 },
    labelMd: {
      fontFamily: body,
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
    },
    labelSm: {
      fontFamily: body,
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
    },
    labelXs: {
      fontFamily: body,
      fontSize: '9px',
      fontWeight: 700,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
    },
  },
  shape: { borderRadius: tokens.radius.md },
  spacing: 8,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // tabular-nums app-wide so counts/quantities align (design-system.md). The custom
        // display*/label* variants also set it, but components still use standard MUI variants
        // until the per-surface chunks migrate them — applying it on body makes it effective now.
        body: {
          backgroundColor: tokens.surface.base,
          color: tokens.text.primary,
          fontVariantNumeric: 'tabular-nums',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          // Canonical button radius, system-wide (artboard spec = 10). Per-surface overrides
          // that re-set this to radius.lg are now redundant and inherit from here.
          borderRadius: tokens.radius.lg,
          textTransform: 'none',
          fontWeight: 600,
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
        containedPrimary: { color: tokens.surface.base },
        // Text buttons (Cancel / Done / back, etc.) are flush iOS-style text actions. MUI's
        // default text-variant hover paints a translucent rounded rect; when the button sits
        // in a rounded popover/dialog corner (overflow:hidden) that rect bleeds into the corner
        // and clips flat — reads as a rendering artifact. Use a contained opacity dim instead:
        // no background box means nothing to clip, on any surface.
        text: {
          '&:hover': { backgroundColor: 'transparent', opacity: 0.65 },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.surface.raised,
          backgroundImage: 'none',
          borderRadius: tokens.radius.xxl,
          border: `1px solid ${tokens.border.subtle}`,
          boxShadow: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none', backgroundColor: tokens.surface.raised },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.surface.raised,
          backgroundImage: 'none',
          boxShadow: 'none',
          borderBottom: `1px solid ${tokens.border.subtle}`,
        },
      },
    },
    // NOTE: MuiTypography styleOverrides for the custom variants (displayXl etc.) are NOT
    // valid override slots under MUI v7 types. The custom typography variants above already
    // set fontVariantNumeric: 'tabular-nums', so the component override was redundant — dropped.
  },
});

export const darkTheme = createTheme(createThemeOptions());

// Reusable responsive dialog styling for full-screen mobile experience.
// PRESERVED — 16 consumers import this from theme.ts; do not remove.
export const responsiveDialogStyle = {
  '& .MuiDialog-paper': {
    margin: { xs: 0, sm: 'auto', md: 'auto', lg: 'auto', xl: 'auto' },
    width: { xs: '100%' },
    height: { xs: '100%', sm: 'auto', md: 'auto', lg: 'auto', xl: 'auto' },
    maxHeight: { xs: '100%', sm: '90vh', md: '90vh', lg: '90vh', xl: '90vh' },
  },
};
