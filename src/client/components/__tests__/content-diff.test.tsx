// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ContentDiff } from '../content-diff.js';

afterEach(() => {
  cleanup();
});

describe('ContentDiff', () => {
  it('renders nothing when before and after are identical', () => {
    const { container } = render(<ContentDiff before="same text" after="same text" />);
    expect(container.querySelector('[data-content-diff]')).toBeNull();
  });

  it('renders nothing when both before and after are empty', () => {
    const { container } = render(<ContentDiff before="" after="" />);
    expect(container.querySelector('[data-content-diff]')).toBeNull();
  });

  it('renders removed-token spans for words present only in before', () => {
    render(<ContentDiff before="Use SQLite for the store" after="Use Postgres for the store" />);
    const removed = screen.getAllByTestId('content-diff-removed');
    expect(removed.length).toBeGreaterThan(0);
    expect(removed.some((span) => span.textContent?.includes('SQLite'))).toBe(true);
  });

  it('renders added-token spans for words present only in after', () => {
    render(<ContentDiff before="Use SQLite for the store" after="Use Postgres for the store" />);
    const added = screen.getAllByTestId('content-diff-added');
    expect(added.length).toBeGreaterThan(0);
    expect(added.some((span) => span.textContent?.includes('Postgres'))).toBe(true);
  });

  it('preserves unchanged surrounding tokens verbatim', () => {
    const { container } = render(<ContentDiff before="alpha beta gamma" after="alpha delta gamma" />);
    const root = container.querySelector('[data-content-diff]');
    expect(root).not.toBeNull();
    expect(root!.textContent).toContain('alpha');
    expect(root!.textContent).toContain('gamma');
  });

  it('marks added and removed spans with data-diff-kind for styling hooks', () => {
    render(<ContentDiff before="alpha" after="beta" />);
    const removed = screen.getByText('alpha');
    const added = screen.getByText('beta');
    expect(removed.getAttribute('data-diff-kind')).toBe('removed');
    expect(added.getAttribute('data-diff-kind')).toBe('added');
  });

  it('renders an optional label when provided', () => {
    render(<ContentDiff before="alpha" after="beta" label="Content" />);
    expect(screen.getByText('Content')).toBeTruthy();
  });

  it('handles a pure addition (empty before, non-empty after)', () => {
    render(<ContentDiff before="" after="new content here" />);
    const added = screen.getAllByTestId('content-diff-added');
    expect(added.length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId('content-diff-removed').length).toBe(0);
  });

  it('handles a pure removal (non-empty before, empty after)', () => {
    render(<ContentDiff before="old content here" after="" />);
    const removed = screen.getAllByTestId('content-diff-removed');
    expect(removed.length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId('content-diff-added').length).toBe(0);
  });
});
