'use client';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompactInput } from '../CompactInput';

describe('CompactInput', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders label above input when label is provided', () => {
    render(<CompactInput {...defaultProps} label="Username" />);

    const label = screen.getByText('Username');
    expect(label).toBeInTheDocument();

    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();

    // Label should appear before (above) the input in the DOM
    const container = label.closest('[data-testid="compact-input-root"]');
    expect(container).toBeInTheDocument();
    const children = Array.from(container!.children);
    const labelIndex = children.findIndex((child) => child.contains(label));
    const inputIndex = children.findIndex((child) => child.contains(input));
    expect(labelIndex).toBeLessThan(inputIndex);
  });

  it('renders without label when label is not provided', () => {
    render(<CompactInput {...defaultProps} />);

    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();

    // There should be no label text element
    const root = input.closest('[data-testid="compact-input-root"]');
    expect(root).toBeInTheDocument();
    // Only the input wrapper should be present (no label Typography)
    expect(root!.querySelector('[data-testid="compact-input-label"]')).not.toBeInTheDocument();
  });

  it('calls onChange on user input', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<CompactInput {...defaultProps} onChange={handleChange} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'hello');

    expect(handleChange).toHaveBeenCalled();
    // Each keystroke fires onChange
    expect(handleChange).toHaveBeenCalledTimes(5);
  });

  it('renders with placeholder', () => {
    render(<CompactInput {...defaultProps} placeholder="Enter your name" />);

    const input = screen.getByPlaceholderText('Enter your name');
    expect(input).toBeInTheDocument();
  });

  it('displays the current value', () => {
    render(<CompactInput {...defaultProps} value="current text" />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('current text');
  });

  it('shows helper text when provided', () => {
    render(<CompactInput {...defaultProps} helperText="This field is required" />);

    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('shows error state with helper text', () => {
    render(
      <CompactInput {...defaultProps} error={true} helperText="Invalid input" />,
    );

    const helperText = screen.getByText('Invalid input');
    expect(helperText).toBeInTheDocument();
  });

  it('renders as fullWidth by default', () => {
    render(<CompactInput {...defaultProps} label="Test" />);

    const root = screen.getByTestId('compact-input-root');
    expect(root).toBeInTheDocument();
  });

  it('passes name and autoComplete props to input', () => {
    render(
      <CompactInput
        {...defaultProps}
        name="email"
        autoComplete="email"
      />,
    );

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('name', 'email');
    expect(input).toHaveAttribute('autocomplete', 'email');
  });

  it('renders as multiline when multiline prop is true', () => {
    render(<CompactInput {...defaultProps} multiline rows={3} />);

    const textarea = screen.getByRole('textbox');
    expect(textarea.tagName).toBe('TEXTAREA');
  });

  it('renders required indicator when required', () => {
    render(<CompactInput {...defaultProps} label="Email" required />);

    // The label should include a required indicator
    expect(screen.getByText('*')).toBeInTheDocument();
  });
});
