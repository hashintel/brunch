// @vitest-environment happy-dom

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { GraphEmptyState } from '@/views/graph/GraphEmptyState.js';

// src/server/graph-empty-state.test.ts -> repo root
const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const componentPath = resolve(packageRoot, 'src/views/graph/GraphEmptyState.tsx');

afterEach(() => {
  cleanup();
});

describe('GraphEmptyState module', () => {
  it('exists at src/views/graph/GraphEmptyState.tsx', () => {
    expect(existsSync(componentPath)).toBe(true);
  });
});

describe('GraphEmptyState orientation card', () => {
  it('reuses the list view orientation surface marked with data-graph-empty-state', () => {
    const { container } = render(createElement(GraphEmptyState));

    // The list view's orientation card marks itself with data-graph-empty-state;
    // reusing it (rather than inventing a separate empty surface) means the same
    // marker is present here.
    expect(container.querySelector('[data-graph-empty-state]')).toBeTruthy();
  });

  it('shows the "knowledge appears as the interview progresses" orientation message', () => {
    render(createElement(GraphEmptyState));

    expect(screen.getByText(/knowledge.*interview progresses/i)).toBeTruthy();
  });

  it('matches the list view orientation copy rather than a bespoke empty message', () => {
    render(createElement(GraphEmptyState));

    // The shared orientation card carries the list view's "No knowledge captured
    // yet" heading; a separate empty surface would not.
    expect(screen.getByText(/no knowledge captured yet/i)).toBeTruthy();
  });

  it('renders the supplied back-to-chat action inside the card', () => {
    const action = createElement('a', { href: '/back-to-chat' }, 'Back to chat');
    const { container } = render(createElement(GraphEmptyState, { action }));

    const link = screen.getByRole('link', { name: 'Back to chat' });
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/back-to-chat');

    // The action lives inside the orientation card, not floating elsewhere.
    const card = container.querySelector('[data-graph-empty-state]');
    expect(card).toBeTruthy();
    expect(card?.contains(link)).toBe(true);
  });

  it('still renders the orientation message when no back-to-chat action is supplied', () => {
    render(createElement(GraphEmptyState));

    expect(screen.getByText(/knowledge.*interview progresses/i)).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
