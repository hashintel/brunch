import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ClientMutationError, postJsonMutation } from './client-mutation.js';

const fetchMock = vi.fn<typeof fetch>();

describe('client mutation', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns parsed json on success', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 7 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      postJsonMutation<{ id: number }, { name: string }>(
        '/api/projects',
        { name: 'New project' },
        'Failed to create project',
      ),
    ).resolves.toEqual({ id: 7 });
  });

  it('surfaces network failures with the caller fallback message', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network down'));

    await expect(
      postJsonMutation<{ id: number }, { name: string }>(
        '/api/projects',
        { name: 'New project' },
        'Failed to create project',
      ),
    ).rejects.toEqual(new ClientMutationError('Failed to create project'));
  });

  it('surfaces json error messages from the server', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Project name already exists' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      postJsonMutation<{ id: number }, { name: string }>(
        '/api/projects',
        { name: 'New project' },
        'Failed to create project',
      ),
    ).rejects.toMatchObject({
      name: 'ClientMutationError',
      message: 'Project name already exists',
      status: 409,
    });
  });

  it('falls back when an error response body is not json', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('upstream exploded', {
        status: 502,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    await expect(
      postJsonMutation<{ id: number }, { name: string }>(
        '/api/projects',
        { name: 'New project' },
        'Failed to create project',
      ),
    ).rejects.toMatchObject({
      name: 'ClientMutationError',
      message: 'Failed to create project',
      status: 502,
    });
  });

  it('surfaces malformed success payloads as mutation errors', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      postJsonMutation<{ id: number }, { name: string }>(
        '/api/projects',
        { name: 'New project' },
        'Failed to create project',
      ),
    ).rejects.toMatchObject({
      name: 'ClientMutationError',
      message: 'Failed to create project',
      status: 200,
    });
  });
});
