// src/types/mui.d.ts
// Custom MUI palette keys + typography variants for the redesign.
import '@mui/material/styles';
import '@mui/material/Typography';

declare module '@mui/material/styles' {
  interface Palette {
    section: { plans: string; shop: string; recipes: string; pantry: string };
    mealColor: { breakfast: string; lunch: string; dinner: string; staples: string };
    accentUtility: string;
  }
  interface PaletteOptions {
    section?: { plans: string; shop: string; recipes: string; pantry: string };
    mealColor?: { breakfast: string; lunch: string; dinner: string; staples: string };
    accentUtility?: string;
  }

  interface TypographyVariants {
    displayXl: React.CSSProperties;
    displayLg: React.CSSProperties;
    displayMd: React.CSSProperties;
    displaySm: React.CSSProperties;
    displayXs: React.CSSProperties;
    bodyLg: React.CSSProperties;
    bodyMd: React.CSSProperties;
    bodySm: React.CSSProperties;
    bodyXs: React.CSSProperties;
    labelMd: React.CSSProperties;
    labelSm: React.CSSProperties;
    labelXs: React.CSSProperties;
  }
  interface TypographyVariantsOptions {
    displayXl?: React.CSSProperties;
    displayLg?: React.CSSProperties;
    displayMd?: React.CSSProperties;
    displaySm?: React.CSSProperties;
    displayXs?: React.CSSProperties;
    bodyLg?: React.CSSProperties;
    bodyMd?: React.CSSProperties;
    bodySm?: React.CSSProperties;
    bodyXs?: React.CSSProperties;
    labelMd?: React.CSSProperties;
    labelSm?: React.CSSProperties;
    labelXs?: React.CSSProperties;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    displayXl: true;
    displayLg: true;
    displayMd: true;
    displaySm: true;
    displayXs: true;
    bodyLg: true;
    bodyMd: true;
    bodySm: true;
    bodyXs: true;
    labelMd: true;
    labelSm: true;
    labelXs: true;
  }
}
