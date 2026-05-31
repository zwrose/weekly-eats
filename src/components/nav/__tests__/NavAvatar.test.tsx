import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { NavAvatar, initialsFromName } from '../NavAvatar';

afterEach(cleanup);

describe('initialsFromName', () => {
  it.each([
    ['Zach Rose', 'ZR'],
    ['zach', 'Z'],
    ['Mary Jane Watson', 'MW'],
    ['', '?'],
    [undefined, '?'],
  ])('derives initials from %s', (name, expected) => {
    expect(initialsFromName(name)).toBe(expected);
  });
});

describe('NavAvatar', () => {
  it('falls back to initials when no image is provided', () => {
    const { getByText, container } = render(<NavAvatar name="Zach Rose" />);
    expect(getByText('ZR')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders the profile image (via the caching proxy) when one is provided', () => {
    const { container } = render(
      <NavAvatar name="Zach Rose" image="https://lh3.googleusercontent.com/abc123" />
    );
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toContain('/api/avatar');
  });
});
