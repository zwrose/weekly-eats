/* eslint-disable */
// Semantic design tokens — single source of truth for the Weekly Eats redesign.
// Two themes (dark, light), every value used in the specimen canvas + dev's theme.ts.

const TOKENS = {
  dark: {
    surface: {
      base:     '#0f1115',
      raised:   '#181b21',
      elevated: '#1e222a',
      sunken:   '#141619',
      sheet:    '#1a1e26',
    },
    text: {
      primary:   '#e7e9ee',
      secondary: '#9097a6',
      muted:     '#5b6170',
      past:      '#7b818f',
    },
    border: {
      subtle: 'rgba(255,255,255,0.07)',
      strong: 'rgba(255,255,255,0.13)',
    },
    accent: {
      base:  '#7aa7ff',
      muted: 'rgba(122,167,255,0.16)',
    },
    success: { base: '#8edcb4', muted: 'rgba(142,220,180,0.14)' },
    danger:  { base: '#e87a8a' },
    warn:    { base: '#f0c674', muted: 'rgba(240,198,116,0.12)' },
    meal: {
      breakfast: '#e8c97a',
      lunch:     '#8edcb4',
      dinner:    '#f0a08a',
      staples:   '#c4a7e7',
    },
    section: {
      plans:   '#7aa7ff',
      shop:    '#6fcf97',
      recipes: '#e8a86b',
      pantry:  '#c79bff',
    },
  },
  light: {
    surface: {
      base:     '#fafaf7',
      raised:   '#ffffff',
      elevated: '#f5f3ed',
      sunken:   '#efeae0',
      sheet:    '#ffffff',
    },
    text: {
      primary:   '#1a1d23',
      secondary: '#5b6170',
      muted:     '#9097a6',
      past:      '#7b818f',
    },
    border: {
      subtle: 'rgba(0,0,0,0.08)',
      strong: 'rgba(0,0,0,0.14)',
    },
    accent: {
      base:  '#2a6fdb',
      muted: 'rgba(42,111,219,0.10)',
    },
    success: { base: '#2e9b6e', muted: 'rgba(46,155,110,0.10)' },
    danger:  { base: '#c14b5d' },
    warn:    { base: '#b58430', muted: 'rgba(181,132,48,0.10)' },
    meal: {
      breakfast: '#b58430',
      lunch:     '#2e9b6e',
      dinner:    '#c4634a',
      staples:   '#8a64c0',
    },
    section: {
      plans:   '#2a6fdb',
      shop:    '#1f8a5b',
      recipes: '#b56a1f',
      pantry:  '#6f4cb0',
    },
  },
};

const TYPE = {
  display: 'Bricolage Grotesque, system-ui, sans-serif',
  body:    'Outfit, system-ui, sans-serif',
  scale: {
    'display.xl': { family:'display', size:32, weight:700, track:'-0.025em' },
    'display.lg': { family:'display', size:30, weight:700, track:'-0.02em'  },
    'display.md': { family:'display', size:24, weight:700, track:'-0.02em'  },
    'display.sm': { family:'display', size:18, weight:700, track:'-0.01em'  },
    'display.xs': { family:'display', size:15, weight:700, track:'-0.01em'  },
    'body.lg':    { family:'body',    size:14, weight:500, track:'normal'   },
    'body.md':    { family:'body',    size:13, weight:500, track:'normal'   },
    'body.sm':    { family:'body',    size:12, weight:400, track:'normal'   },
    'body.xs':    { family:'body',    size:11, weight:400, track:'normal'   },
    'label.md':   { family:'body',    size:11, weight:700, track:'0.14em', upper:true },
    'label.sm':   { family:'body',    size:10, weight:700, track:'0.16em', upper:true },
    'label.xs':   { family:'body',    size: 9, weight:700, track:'0.16em', upper:true },
  },
};

const SPACE = { xs:4, sm:8, md:12, base:14, lg:16, xl:18, '2xl':22, '3xl':24, '4xl':32 };
const RADIUS = { xs:4, sm:6, md:8, lg:10, xl:12, '2xl':14, '3xl':16, sheet:18, pill:999 };

Object.assign(window, { TOKENS, TYPE, SPACE, RADIUS });
