import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PresenceAvatar } from '../PresenceAvatar';

describe('PresenceAvatar', () => {
  it('shows derived initials and an accessible name', () => {
    render(<PresenceAvatar name="Sara Rose" email="sara@x.com" size={20} />);
    expect(screen.getByText('SR')).toBeInTheDocument();
    expect(screen.getByLabelText('Sara Rose')).toBeInTheDocument();
  });
});
