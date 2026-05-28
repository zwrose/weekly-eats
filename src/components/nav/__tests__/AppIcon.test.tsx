import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AppIcon } from '../AppIcon';

afterEach(cleanup);

describe('AppIcon', () => {
  it('renders an svg logomark with four meal blocks', () => {
    const { container } = render(<AppIcon size={30} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('width')).toBe('30');
    expect(container.querySelectorAll('rect[rx="1"]').length).toBe(4);
  });

  it('is decorative (aria-hidden) by default', () => {
    const { container } = render(<AppIcon />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('squircled variant adds a background rect', () => {
    const { container } = render(<AppIcon squircled />);
    expect(container.querySelector('rect[data-squircle="true"]')).toBeTruthy();
  });
});
