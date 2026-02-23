import { describe, it, expect } from 'vitest';
import {
  STAGGER_LIMIT,
  STAGGER_DELAY_MS,
  getStaggerDelay,
  ANIMATIONS,
  DURATIONS,
  EASINGS,
  getStaggeredAnimationSx,
} from '../animation-utils';

describe('animation-utils constants', () => {
  it('exports STAGGER_LIMIT as 10', () => {
    expect(STAGGER_LIMIT).toBe(10);
  });

  it('exports STAGGER_DELAY_MS as 30', () => {
    expect(STAGGER_DELAY_MS).toBe(30);
  });

  it('ANIMATIONS exports all animation names', () => {
    expect(ANIMATIONS.fadeInUp).toBe('fadeInUp');
    expect(ANIMATIONS.fadeIn).toBe('fadeIn');
    expect(ANIMATIONS.slideInRight).toBe('slideInRight');
  });

  it('DURATIONS exports CSS variable references', () => {
    expect(DURATIONS.fast).toBe('var(--duration-fast)');
    expect(DURATIONS.normal).toBe('var(--duration-normal)');
    expect(DURATIONS.slow).toBe('var(--duration-slow)');
  });

  it('EASINGS exports CSS variable references', () => {
    expect(EASINGS.out).toBe('var(--ease-out)');
    expect(EASINGS.inOut).toBe('var(--ease-in-out)');
  });
});

describe('getStaggerDelay', () => {
  it('returns 0 for index 0', () => {
    expect(getStaggerDelay(0)).toBe(0);
  });

  it('returns correct delay for index 1', () => {
    expect(getStaggerDelay(1)).toBe(30);
  });

  it('returns correct delay for index 5', () => {
    expect(getStaggerDelay(5)).toBe(150);
  });

  it('returns correct delay for index 9 (last valid index)', () => {
    expect(getStaggerDelay(9)).toBe(270);
  });

  it('returns 0 for index equal to STAGGER_LIMIT (10)', () => {
    expect(getStaggerDelay(10)).toBe(0);
  });

  it('returns 0 for index greater than STAGGER_LIMIT', () => {
    expect(getStaggerDelay(11)).toBe(0);
    expect(getStaggerDelay(100)).toBe(0);
  });

  it('returns correct values for all indices 0-9', () => {
    for (let i = 0; i < STAGGER_LIMIT; i++) {
      expect(getStaggerDelay(i)).toBe(i * STAGGER_DELAY_MS);
    }
  });
});

describe('getStaggeredAnimationSx', () => {
  it('returns sx object with animation in no-preference media query', () => {
    const sx = getStaggeredAnimationSx(0);
    expect(sx['@media (prefers-reduced-motion: no-preference)']).toBeDefined();
    expect(sx['@media (prefers-reduced-motion: no-preference)'].animation).toContain('fadeInUp');
    expect(sx['@media (prefers-reduced-motion: no-preference)'].opacity).toBe(0);
  });

  it('returns sx object with opacity 1 in reduce media query', () => {
    const sx = getStaggeredAnimationSx(0);
    expect(sx['@media (prefers-reduced-motion: reduce)']).toBeDefined();
    expect(sx['@media (prefers-reduced-motion: reduce)'].opacity).toBe(1);
  });

  it('sets animationDelay to 0ms for index 0', () => {
    const sx = getStaggeredAnimationSx(0);
    expect(sx['@media (prefers-reduced-motion: no-preference)'].animationDelay).toBe('0ms');
  });

  it('sets correct animationDelay for index 3', () => {
    const sx = getStaggeredAnimationSx(3);
    expect(sx['@media (prefers-reduced-motion: no-preference)'].animationDelay).toBe('90ms');
  });

  it('sets animationDelay to 0ms for index >= STAGGER_LIMIT', () => {
    const sx = getStaggeredAnimationSx(10);
    expect(sx['@media (prefers-reduced-motion: no-preference)'].animationDelay).toBe('0ms');
  });

  it('includes CSS variable references in animation property', () => {
    const sx = getStaggeredAnimationSx(0);
    const animation = sx['@media (prefers-reduced-motion: no-preference)'].animation;
    expect(animation).toContain('var(--duration-normal)');
    expect(animation).toContain('var(--ease-out)');
    expect(animation).toContain('forwards');
  });
});
