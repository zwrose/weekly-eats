import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Icon } from '../Icon';

afterEach(cleanup);

describe('Icon', () => {
  it('renders the ligature name as text content', () => {
    const { container } = render(<Icon name="kitchen" />);
    expect(container.textContent).toBe('kitchen');
  });

  it('is decorative (aria-hidden) by default', () => {
    const { container } = render(<Icon name="delete" />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies the icon font var and size', () => {
    const { container } = render(<Icon name="add" size={20} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.fontSize).toBe('20px');
    expect(el.style.fontFamily).toContain('--font-icons');
  });

  it('reflects the fill axis in font-variation-settings', () => {
    const { container } = render(<Icon name="star" fill />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.fontVariationSettings).toContain("'FILL' 1");
  });

  it('becomes a labeled img when an aria-label is provided', () => {
    const { container } = render(<Icon name="info" aria-label="More info" />);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute('role')).toBe('img');
    expect(el.getAttribute('aria-label')).toBe('More info');
    expect(el.getAttribute('aria-hidden')).toBeNull();
  });
});
