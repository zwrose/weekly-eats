import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { email: 'me@example.com' } }, status: 'authenticated' }),
}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../../../components/AuthenticatedLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import SettingsPage from '../page';

afterEach(cleanup);

describe('SettingsPage (placeholder)', () => {
  it('renders the placeholder copy and no theme selector', () => {
    render(<SettingsPage />);
    expect(screen.getByText(/light mode will return/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/theme/i)).not.toBeInTheDocument();
  });
});
