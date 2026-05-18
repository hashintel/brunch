// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CHAT_SHELL_SPRING, usePrefersReducedMotion } from '../use-prefers-reduced-motion.js';

function Probe() {
  const reduced = usePrefersReducedMotion();
  return <output data-testid="reduced">{String(reduced)}</output>;
}

const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  (window as { matchMedia?: typeof window.matchMedia }).matchMedia = originalMatchMedia;
});

afterEach(() => {
  cleanup();
  (window as { matchMedia?: typeof window.matchMedia }).matchMedia = originalMatchMedia;
});

describe('usePrefersReducedMotion', () => {
  it('publishes the canonical CHAT_SHELL_SPRING config used by motion consumers', () => {
    expect(CHAT_SHELL_SPRING).toEqual({ type: 'spring', mass: 0.6, stiffness: 220, damping: 30 });
  });

  it('returns true when the matchMedia query matches', () => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    render(<Probe />);
    expect(screen.getByTestId('reduced').textContent).toBe('true');
  });

  it('returns false when the matchMedia query does not match', () => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    render(<Probe />);
    expect(screen.getByTestId('reduced').textContent).toBe('false');
  });

  it('returns false when matchMedia is missing on the window', () => {
    (window as { matchMedia?: typeof window.matchMedia }).matchMedia = undefined;

    render(<Probe />);
    expect(screen.getByTestId('reduced').textContent).toBe('false');
  });
});
