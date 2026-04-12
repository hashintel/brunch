// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EntitiesData, ProjectState } from '../../shared/api-types.js';
import { fetchInterviewWorkspaceLoaderData, fetchKnowledgeWorkspaceLoaderData } from './workspace-loader.js';

const fetchMock = vi.fn<typeof fetch>();

const projectState: ProjectState = {
  project: {
    id: 7,
    name: 'Project 7',
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

describe('workspace route loaders', () => {
  it('loads interview workspace route data from the project and entities endpoints', async () => {
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

    await expect(fetchInterviewWorkspaceLoaderData(7)).resolves.toEqual({ projectState, entitySnapshot });
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/projects/7');
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/projects/7/entities');
  });

  it('loads knowledge workspace route data from the same current route contract through its own helper', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(entitySnapshot), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(fetchKnowledgeWorkspaceLoaderData('7')).resolves.toEqual({ entitySnapshot });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/7/entities');
  });
});
