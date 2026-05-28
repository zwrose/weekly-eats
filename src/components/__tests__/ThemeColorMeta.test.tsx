import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ThemeColorMeta } from '../ThemeColorMeta';

afterEach(cleanup);

describe('ThemeColorMeta', () => {
  it('sets the theme-color meta tag to the dark surface base', () => {
    render(<ThemeColorMeta />);
    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta?.getAttribute('content')).toBe('#0f1115');
  });
});
