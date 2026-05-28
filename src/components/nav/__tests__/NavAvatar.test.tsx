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
  it('renders the initials', () => {
    const { getByText } = render(<NavAvatar name="Zach Rose" />);
    expect(getByText('ZR')).toBeInTheDocument();
  });

  it('is decorative (aria-hidden)', () => {
    const { container } = render(<NavAvatar name="Zach Rose" />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});
