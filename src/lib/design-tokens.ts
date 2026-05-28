// src/lib/design-tokens.ts
// Canonical dark-theme design tokens (from docs/design/weekly-eats-redesign/project/design-system.md).
// Light mode is dropped; only dark values live here. The MUI palette in theme.ts is DERIVED from
// these — components consume the section accent via palette.primary (rebound per section in later
// chunks), NOT by importing tokens.section.* directly. Direct token imports are reserved for values
// with no palette home (meal colors, spacing/radii/shadow constants).

export const tokens = {
  surface: {
    base: '#0f1115',
    raised: '#181b21',
    elevated: '#1e222a',
    sunken: '#141619',
    sheet: '#1a1e26',
  },
  text: {
    primary: '#e7e9ee',
    secondary: '#9097a6',
    muted: '#5b6170',
    past: '#7b818f',
  },
  border: {
    subtle: 'rgba(255,255,255,0.07)',
    strong: 'rgba(255,255,255,0.13)',
  },
  accent: {
    base: '#7aa7ff',
    muted: 'rgba(122,167,255,0.16)',
  },
  section: {
    plans: '#7aa7ff',
    shop: '#6fcf97',
    recipes: '#e8a86b',
    pantry: '#c79bff',
  },
  accentUtility: '#9aa4b3',
  state: {
    success: '#8edcb4',
    successMuted: 'rgba(142,220,180,0.14)',
    danger: '#e87a8a',
    dangerMuted: 'rgba(232,122,138,0.14)',
    warn: '#f0c674',
    warnMuted: 'rgba(240,198,116,0.12)',
  },
  meal: {
    breakfast: '#e8c97a',
    lunch: '#8edcb4',
    dinner: '#f0a08a',
    staples: '#c4a7e7',
  },
  space: { xs: 4, sm: 8, md: 12, base: 14, lg: 16, xl: 18, xxl: 22, xxxl: 24, huge: 32 },
  radius: { xs: 4, sm: 6, md: 8, lg: 10, xl: 12, xxl: 14, xxxl: 16, sheet: 18, pill: 999 },
  shadow: {
    soft: '0 2px 8px rgba(0,0,0,0.12)',
    card: '0 0 0 3px rgba(122,167,255,0.08)',
    sheet: '0 -10px 30px rgba(0,0,0,0.4)',
    modal: '0 24px 60px rgba(0,0,0,0.5)',
  },
} as const;

export type DesignTokens = typeof tokens;
