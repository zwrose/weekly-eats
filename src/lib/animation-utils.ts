export const STAGGER_LIMIT = 10;
export const STAGGER_DELAY_MS = 30;

export function getStaggerDelay(index: number): number {
  if (index >= STAGGER_LIMIT) return 0;
  return index * STAGGER_DELAY_MS;
}

export const ANIMATIONS = {
  fadeInUp: 'fadeInUp',
  fadeIn: 'fadeIn',
  slideInRight: 'slideInRight',
} as const;

export const DURATIONS = {
  fast: 'var(--duration-fast)',
  normal: 'var(--duration-normal)',
  slow: 'var(--duration-slow)',
} as const;

export const EASINGS = {
  out: 'var(--ease-out)',
  inOut: 'var(--ease-in-out)',
} as const;

// Helper to create staggered animation sx prop for a list item
export function getStaggeredAnimationSx(index: number) {
  const delay = getStaggerDelay(index);
  return {
    '@media (prefers-reduced-motion: no-preference)': {
      animation: `${ANIMATIONS.fadeInUp} var(--duration-normal) var(--ease-out) forwards`,
      animationDelay: `${delay}ms`,
      opacity: 0,
    },
    '@media (prefers-reduced-motion: reduce)': {
      opacity: 1,
    },
  };
}
