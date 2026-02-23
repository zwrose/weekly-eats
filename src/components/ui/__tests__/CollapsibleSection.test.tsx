'use client';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CollapsibleSection } from '../CollapsibleSection';

describe('CollapsibleSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders collapsed by default when defaultExpanded is false', () => {
    render(
      <CollapsibleSection title="Section Title">
        <p>Hidden content</p>
      </CollapsibleSection>,
    );

    const header = screen.getByTestId('collapsible-header');
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Section Title')).toBeInTheDocument();
    // Content is in the DOM but visually hidden via grid animation
    expect(screen.getByText('Hidden content')).toBeInTheDocument();
  });

  it('renders expanded when defaultExpanded is true', () => {
    render(
      <CollapsibleSection title="Open Section" defaultExpanded>
        <p>Visible content</p>
      </CollapsibleSection>,
    );

    const header = screen.getByTestId('collapsible-header');
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Visible content')).toBeInTheDocument();
  });

  it('toggles expanded state on header click', async () => {
    const user = userEvent.setup();

    render(
      <CollapsibleSection title="Toggle Section">
        <p>Content</p>
      </CollapsibleSection>,
    );

    const header = screen.getByTestId('collapsible-header');
    expect(header).toHaveAttribute('aria-expanded', 'false');

    // Click to expand
    await user.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'true');

    // Click to collapse
    await user.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles on Enter key press', async () => {
    const user = userEvent.setup();

    render(
      <CollapsibleSection title="Keyboard Section">
        <p>Content</p>
      </CollapsibleSection>,
    );

    const header = screen.getByTestId('collapsible-header');
    header.focus();

    await user.keyboard('{Enter}');
    expect(header).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Enter}');
    expect(header).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles on Space key press', async () => {
    const user = userEvent.setup();

    render(
      <CollapsibleSection title="Space Section">
        <p>Content</p>
      </CollapsibleSection>,
    );

    const header = screen.getByTestId('collapsible-header');
    header.focus();

    await user.keyboard(' ');
    expect(header).toHaveAttribute('aria-expanded', 'true');
  });

  it('displays the title', () => {
    render(
      <CollapsibleSection title="My Section">
        <p>Content</p>
      </CollapsibleSection>,
    );

    expect(screen.getByText('My Section')).toBeInTheDocument();
  });

  it('displays rightContent when provided', () => {
    render(
      <CollapsibleSection
        title="Section"
        rightContent={<span>Skipped</span>}
      >
        <p>Content</p>
      </CollapsibleSection>,
    );

    expect(screen.getByText('Skipped')).toBeInTheDocument();
    expect(screen.getByTestId('collapsible-right-content')).toBeInTheDocument();
  });

  it('does not render rightContent container when rightContent is not provided', () => {
    render(
      <CollapsibleSection title="Section">
        <p>Content</p>
      </CollapsibleSection>,
    );

    expect(
      screen.queryByTestId('collapsible-right-content'),
    ).not.toBeInTheDocument();
  });

  it('has correct aria-controls linking header to content', () => {
    render(
      <CollapsibleSection title="Accessible Section">
        <p>Content</p>
      </CollapsibleSection>,
    );

    const header = screen.getByTestId('collapsible-header');
    const contentId = header.getAttribute('aria-controls');
    expect(contentId).toBeTruthy();

    const content = screen.getByTestId('collapsible-content');
    expect(content).toHaveAttribute('id', contentId);
  });

  it('has role="region" on the content area', () => {
    render(
      <CollapsibleSection title="Region Section">
        <p>Content</p>
      </CollapsibleSection>,
    );

    const content = screen.getByTestId('collapsible-content');
    expect(content).toHaveAttribute('role', 'region');
  });

  it('renders a chevron icon', () => {
    render(
      <CollapsibleSection title="Icon Section">
        <p>Content</p>
      </CollapsibleSection>,
    );

    expect(screen.getByTestId('collapsible-chevron')).toBeInTheDocument();
  });

  it('renders children content', () => {
    render(
      <CollapsibleSection title="Section" defaultExpanded>
        <div data-testid="child-content">
          <p>First item</p>
          <p>Second item</p>
        </div>
      </CollapsibleSection>,
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('First item')).toBeInTheDocument();
    expect(screen.getByText('Second item')).toBeInTheDocument();
  });

  it('accepts a ReactNode as title', () => {
    render(
      <CollapsibleSection
        title={
          <span data-testid="custom-title">
            Custom <strong>Title</strong>
          </span>
        }
      >
        <p>Content</p>
      </CollapsibleSection>,
    );

    expect(screen.getByTestId('custom-title')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
  });
});
