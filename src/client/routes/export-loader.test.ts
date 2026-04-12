// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchExportPreviewLoaderData } from './export-loader.js';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('export route loader', () => {
  it('loads export preview data from the export endpoint', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ready: true, markdown: '# Reviewed Spec' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(fetchExportPreviewLoaderData(7)).resolves.toEqual({
      ready: true,
      markdown: '# Reviewed Spec',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/7/export');
  });

  it('rejects when the export payload is malformed json', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(fetchExportPreviewLoaderData(7)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/7/export');
  });

  it('rejects when the export payload is parseable json with the wrong shape', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ready: 'yes' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(fetchExportPreviewLoaderData(7)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/7/export');
  });

  it('rejects when a ready export payload omits markdown', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ready: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(fetchExportPreviewLoaderData(7)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/7/export');
  });
});
