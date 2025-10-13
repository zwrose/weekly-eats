import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SignInButton from '../SignInButton';

// Mock next-auth/react
const mockSignIn = vi.fn();
vi.mock('next-auth/react', () => ({
  signIn: () => mockSignIn(),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: vi.fn(() => null),
  }),
}));

describe('SignInButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders sign in button', () => {
    render(<SignInButton />);
    
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
  });

  it('calls signIn when button is clicked', async () => {
    const user = userEvent.setup();
    render(<SignInButton />);
    
    const signInButton = screen.getByRole('button', { name: /sign in with google/i });
    await user.click(signInButton);
    
    expect(mockSignIn).toHaveBeenCalled();
  });

  it('has correct styling and content', () => {
    render(<SignInButton />);
    
    const button = screen.getByRole('button', { name: /sign in with google/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Sign in with Google');
  });
});
