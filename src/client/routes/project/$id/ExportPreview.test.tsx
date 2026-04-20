// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ExportLoaderData } from '@/shared/api-types.js';

import { ExportPreview } from './-export-preview.js';

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
  ShellButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
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

afterEach(() => {
  cleanup();
  currentLoaderData = { ready: false };
});

describe('ExportPreview', () => {
  it('renders the blocked-export route state when the project is not ready', () => {
    currentLoaderData = { ready: false };

    render(<ExportPreview />);

    expect(screen.getByRole('heading', { name: 'Export Preview' })).toBeTruthy();
    expect(
      screen.getByText('Export is not available yet. All workflow phases must be closed before exporting.'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: /Return to specification/ }).getAttribute('href')).toBe(
      '/project/7',
    );
  });

  it('renders markdown preview and review navigation when export data is ready', () => {
    currentLoaderData = {
      ready: true,
      markdown: '# Reviewed Spec\n\n## Requirements\n\n- Resume from SQLite',
    };

    render(<ExportPreview />);

    expect(screen.getByRole('link', { name: /Back to specification/ }).getAttribute('href')).toBe(
      '/project/7',
    );
    expect(screen.getByRole('button', { name: /Download .md/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Review specification knowledge/ }).getAttribute('href')).toBe(
      '/project/7/framing',
    );
    expect(
      screen.getByText(
        (content, element) => element?.tagName === 'PRE' && content.includes('# Reviewed Spec'),
      ),
    ).toBeTruthy();
  });
});
