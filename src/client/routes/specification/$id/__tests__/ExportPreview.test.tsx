// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ExportLoaderData } from '@/shared/api-types.js';

import { ExportPreview } from '../-export-preview.js';

let currentLoaderData: ExportLoaderData;

function buildHref(to?: string, params?: Record<string, string>) {
  if (!to) {
    return undefined;
  }

  return Object.entries(params ?? {}).reduce((path, [key, value]) => path.replace(`$${key}`, value), to);
}

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    to?: string;
    params?: Record<string, string>;
  }) => (
    <a href={buildHref(to, params)} {...props}>
      {children}
    </a>
  ),
  getRouteApi: () => ({
    useLoaderData: () => currentLoaderData,
    useParams: () => ({ id: '7' }),
  }),
}));

vi.mock('@/client/components/app-shell', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/client/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/client/capabilities/markdown-rendering', () => ({
  MarkdownRenderer: ({ children, className }: { children: string; className?: string }) => (
    <div className={className} data-testid="markdown-renderer">
      {children}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  currentLoaderData = { ready: false };
});

describe('ExportPreview', () => {
  it('renders the blocked-export route state when the project is not ready', () => {
    currentLoaderData = { ready: false };

    render(<ExportPreview />);

    expect(screen.getByRole('heading', { name: 'Specification Output' })).toBeTruthy();
    expect(
      screen.getByText(
        'This completion view unlocks after Grounding, Elicitation, Requirements, and Acceptance Criteria are all closed.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: /Return to specification/ }).getAttribute('href')).toBe(
      '/specification/7',
    );
  });

  it('renders a readable specification output surface when export data is ready', () => {
    currentLoaderData = {
      ready: true,
      markdown: '# Reviewed Spec\n\n## Requirements\n\n- Resume from SQLite',
    };

    render(<ExportPreview />);

    expect(screen.getByRole('heading', { name: 'Specification Output' })).toBeTruthy();
    expect(screen.getByText('Completed specification')).toBeTruthy();
    expect(
      screen.getByText(
        'Accepted Requirements and Acceptance Criteria stay first, with supporting context and closure caveats kept nearby.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: /Back to specification workspace/ }).getAttribute('href')).toBe(
      '/specification/7/grounding',
    );
    expect(screen.getByRole('button', { name: /Download markdown output/ })).toBeTruthy();
    expect(screen.getByTestId('markdown-renderer').textContent).toContain('# Reviewed Spec');
  });
});
