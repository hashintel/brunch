// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SpecificationListItem as ProjectListItem } from '@/shared/specification.js';

import { SpecificationList } from '../-project-list.js';

let currentProjects: ProjectListItem[];
const navigateMock = vi.fn();
const fetchMock = vi.fn<typeof fetch>();

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; params?: { id: string } }) => (
    <a href={to.replace('$id', params?.id ?? '')} {...props}>
      {children}
    </a>
  ),
  getRouteApi: () => ({
    useLoaderData: () => currentProjects,
  }),
  useNavigate: () => navigateMock,
}));

vi.mock('@/client/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/client/components/ui/card', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/client/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderSpecificationList() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <SpecificationList />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  currentProjects = [];
  navigateMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SpecificationList', () => {
  it('creates a specification after name-only entry and navigates to its workspace', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 7,
          name: 'New specification',
          mode: 'greenfield',
          active_turn_id: null,
          created_at: '2026-04-03 10:00:00',
          updated_at: '2026-04-03 10:00:00',
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    renderSpecificationList();
    fireEvent.click(screen.getByRole('button', { name: 'New specification' }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Specification name')).toBeDefined();
    });
    fireEvent.change(screen.getByPlaceholderText('Specification name'), {
      target: { value: 'New specification' },
    });
    fireEvent.click(screen.getByText('Create specification'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/specifications',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'New specification' }),
        }),
      );
    });

    expect(screen.queryByText(/How should this specification start\?/i)).toBeNull();

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/specification/$id', params: { id: '7' } });
    });
  });

  it('renders project cards as real links into the workspace', () => {
    currentProjects = [
      {
        id: 1,
        name: 'Active project',
        mode: 'greenfield',
        active_turn_id: 5,
        created_at: '2026-04-10 09:00:00',
        updated_at: '2026-04-10 09:30:00',
        workflowSummary: {
          grounding: 'closed',
          design: 'in_progress',
          requirements: 'unstarted',
          criteria: 'unstarted',
          currentReadiness: 'medium',
        },
      } satisfies ProjectListItem,
    ];

    renderSpecificationList();

    expect(screen.getByRole('link', { name: /Active project/i }).getAttribute('href')).toBe(
      '/specification/1',
    );
  });

  it('renders current phase indicator and status dots for each project', () => {
    currentProjects = [
      {
        id: 1,
        name: 'Active project',
        mode: 'greenfield',
        active_turn_id: 5,
        created_at: '2026-04-10 09:00:00',
        updated_at: '2026-04-10 09:30:00',
        workflowSummary: {
          grounding: 'closed',
          design: 'in_progress',
          requirements: 'unstarted',
          criteria: 'unstarted',
          currentReadiness: 'medium',
        },
      } satisfies ProjectListItem,
    ];

    renderSpecificationList();
    expect(screen.getByText('Phase')).toBeDefined();
    expect(screen.getByText(/2\/4 – Elicitation/)).toBeDefined();
  });

  it('does not present a root-level grounding strategy step during creation', async () => {
    renderSpecificationList();
    fireEvent.click(screen.getByRole('button', { name: 'New specification' }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Specification name')).toBeDefined();
    });

    expect(screen.queryByText(/How should this specification start\?/i)).toBeNull();
    expect(screen.queryByText(/New concept from scratch/i)).toBeNull();
    expect(screen.queryByText(/Feature within existing codebase/i)).toBeNull();
  });

  it('shows a visible error when specification creation fails', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Specification name already exists' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderSpecificationList();
    fireEvent.click(screen.getByRole('button', { name: 'New specification' }));

    // Enter specification name and submit
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Specification name')).toBeDefined();
    });
    fireEvent.change(screen.getByPlaceholderText('Specification name'), {
      target: { value: 'Bad specification' },
    });
    fireEvent.click(screen.getByText('Create specification'));

    expect((await screen.findByRole('alert')).textContent).toContain('Specification name already exists');
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
