// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectListItem } from '@/shared/api-types.js';

import { ProjectList } from './-project-list.js';

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

function renderProjectList() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <ProjectList />
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

describe('ProjectList', () => {
  it('creates a greenfield specification and navigates to its workspace', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 7,
          name: 'New specification',
          mode: 'greenfield',
          cwd: null,
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

    renderProjectList();
    fireEvent.click(screen.getByRole('button', { name: 'New specification' }));

    // Enter specification name
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Specification name')).toBeDefined();
    });
    fireEvent.change(screen.getByPlaceholderText('Specification name'), {
      target: { value: 'New specification' },
    });
    fireEvent.click(screen.getByText('Next'));

    // Select greenfield mode
    await waitFor(() => {
      expect(screen.getByText(/from scratch/i)).toBeDefined();
    });
    fireEvent.click(screen.getByText(/from scratch/i));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/projects',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/project/$id', params: { id: '7' } });
    });
  });

  it('renders project cards as real links into the workspace', () => {
    currentProjects = [
      {
        id: 1,
        name: 'Active project',
        mode: 'greenfield',
        cwd: null,
        active_turn_id: 5,
        created_at: '2026-04-10 09:00:00',
        updated_at: '2026-04-10 09:30:00',
        workflowSummary: {
          scope: 'closed',
          design: 'in_progress',
          requirements: 'unstarted',
          criteria: 'unstarted',
        },
      } satisfies ProjectListItem,
    ];

    renderProjectList();

    expect(screen.getByRole('link', { name: /Active project/i }).getAttribute('href')).toBe('/project/1');
  });

  it('renders per-phase workflow status badges for each project', () => {
    currentProjects = [
      {
        id: 1,
        name: 'Active project',
        mode: 'greenfield',
        cwd: null,
        active_turn_id: 5,
        created_at: '2026-04-10 09:00:00',
        updated_at: '2026-04-10 09:30:00',
        workflowSummary: {
          scope: 'closed',
          design: 'in_progress',
          requirements: 'unstarted',
          criteria: 'unstarted',
        },
      } satisfies ProjectListItem,
    ];

    renderProjectList();
    expect(screen.getByText('Grounding')).toBeDefined();
    expect(screen.getByText('Elicitation')).toBeDefined();
    expect(screen.getByText('Requirements')).toBeDefined();
    expect(screen.getByText('Acceptance Criteria')).toBeDefined();
  });

  it('sends mode when creating a brownfield specification', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 8,
          name: 'New specification',
          mode: 'brownfield',
          cwd: '/server/path',
          active_turn_id: null,
          created_at: '2026-04-12 10:00:00',
          updated_at: '2026-04-12 10:00:00',
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    renderProjectList();
    fireEvent.click(screen.getByRole('button', { name: 'New specification' }));

    // Enter specification name and proceed to mode step
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Specification name')).toBeDefined();
    });
    fireEvent.change(screen.getByPlaceholderText('Specification name'), {
      target: { value: 'New specification' },
    });
    fireEvent.click(screen.getByText('Next'));

    // Select brownfield mode
    await waitFor(() => {
      expect(screen.getByText(/existing codebase/i)).toBeDefined();
    });
    fireEvent.click(screen.getByText(/existing codebase/i));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      const call = fetchMock.mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);
      expect(body).toEqual({ name: 'New specification', mode: 'brownfield' });
      expect(body.cwd).toBeUndefined();
    });
  });

  it('shows a visible error when specification creation fails', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Specification name already exists' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderProjectList();
    fireEvent.click(screen.getByRole('button', { name: 'New specification' }));

    // Enter specification name and proceed
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Specification name')).toBeDefined();
    });
    fireEvent.change(screen.getByPlaceholderText('Specification name'), {
      target: { value: 'Bad specification' },
    });
    fireEvent.click(screen.getByText('Next'));

    // Select greenfield to trigger fetch
    await waitFor(() => {
      expect(screen.getByText(/from scratch/i)).toBeDefined();
    });
    fireEvent.click(screen.getByText(/from scratch/i));

    expect((await screen.findByRole('alert')).textContent).toContain('Specification name already exists');
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
