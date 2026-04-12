// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExportPreview } from './ExportPreview.js';

type ExportQueryState = {
  data?: { ready: boolean; markdown?: string };
  isLoading: boolean;
};

let currentQueryState: ExportQueryState;

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => currentQueryState,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useParams: () => ({ id: '7' }),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

afterEach(() => {
  cleanup();
  currentQueryState = { isLoading: false };
});

describe('ExportPreview', () => {
  it('renders a loading state while export data is pending', () => {
    currentQueryState = { isLoading: true };

    render(<ExportPreview />);

    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('renders the blocked-export route state when the project is not ready', () => {
    currentQueryState = { isLoading: false, data: { ready: false } };

    render(<ExportPreview />);

    expect(screen.getByRole('heading', { name: 'Export Preview' })).toBeTruthy();
    expect(
      screen.getByText('Export is not available yet. All workflow phases must be closed before exporting.'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Return to interview →' })).toBeTruthy();
  });

  it('renders markdown preview and review navigation when export data is ready', () => {
    currentQueryState = {
      isLoading: false,
      data: {
        ready: true,
        markdown: '# Reviewed Spec\n\n## Requirements\n\n- Resume from SQLite',
      },
    };

    render(<ExportPreview />);

    expect(screen.getByRole('button', { name: 'Download .md' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Review knowledge →' })).toBeTruthy();
    expect(
      screen.getByText(
        (content, element) => element?.tagName === 'PRE' && content.includes('# Reviewed Spec'),
      ),
    ).toBeTruthy();
  });
});
