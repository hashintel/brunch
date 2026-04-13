// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EntitiesData, ProjectState } from '@/shared/api-types.js';

import {
  fetchKnowledgeWorkspaceLoaderData,
  fetchProjectLayoutLoaderData,
  fetchViewLayoutLoaderData,
} from './workspace-loader.js';

const fetchMock = vi.fn<typeof fetch>();

const projectState: ProjectState = {
  project: {
    id: 7,
    name: 'Project 7',
    mode: 'greenfield',
    cwd: null,
    active_turn_id: null,
    created_at: '2026-04-03 10:00:00',
    updated_at: '2026-04-03 10:00:00',
  },
  workflow: {
    phases: {
      scope: {
        status: 'unstarted',
        closeability: false,
        readiness: 'low',
        closureBasis: null,
        proposalPending: false,
        turnId: null,
        summary: null,
      },
      design: {
        status: 'unstarted',
        closeability: false,
        readiness: 'low',
        closureBasis: null,
        proposalPending: false,
        turnId: null,
        summary: null,
      },
      requirements: {
        status: 'unstarted',
        closeability: false,
        readiness: 'low',
        closureBasis: null,
        proposalPending: false,
        turnId: null,
        summary: null,
      },
      criteria: {
        status: 'unstarted',
        closeability: false,
        readiness: 'low',
        closureBasis: null,
        proposalPending: false,
        turnId: null,
        summary: null,
      },
    },
  },
  turns: [],
};

const entitySnapshot: EntitiesData = {
  goals: [],
  terms: [],
  contexts: [],
  constraints: [],
  requirements: [],
  criteria: [],
  decisions: [],
  assumptions: [],
  relationships: [],
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('layout-level route loaders', () => {
  it('ProjectLayout loader fetches only /api/projects/:id and returns ProjectState', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(projectState), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(fetchProjectLayoutLoaderData('7')).resolves.toEqual(projectState);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/7');
  });

  it('ViewLayout loader fetches only /api/projects/:id/entities with active-path mode and returns EntitiesData', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(entitySnapshot), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(fetchViewLayoutLoaderData('7')).resolves.toEqual(entitySnapshot);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/7/entities?mode=active-path');
  });

  it('ProjectLayout loader rejects when the project does not exist', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Not found', { status: 404 }));

    await expect(fetchProjectLayoutLoaderData('999')).rejects.toThrow('Failed to load project');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/999');
  });

  it('ViewLayout loader rejects when entities endpoint fails', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Not found', { status: 404 }));

    await expect(fetchViewLayoutLoaderData('999')).rejects.toThrow('Failed to load project entities');
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe('knowledge workspace route loader', () => {
  it('loads knowledge workspace route data from the active-path entities projection through its own helper', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(projectState), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(entitySnapshot), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    await expect(fetchKnowledgeWorkspaceLoaderData('7')).resolves.toEqual({ entitySnapshot });
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/projects/7');
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/projects/7/entities?mode=active-path');
  });

  it('fails knowledge workspace loading when the project does not exist', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Not found', { status: 404 }));

    await expect(fetchKnowledgeWorkspaceLoaderData('999')).rejects.toThrow('Failed to load project');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/999');
  });
});
