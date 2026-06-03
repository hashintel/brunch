// ---------------------------------------------------------------------------
// Pure base-URL resolution + launcher URL composition.
//
// Two pure functions; no fs, no env reads (env is passed in), no process exits.
// Covers (a) multi-tier base URL resolution (CLI > env > hard fail) and
// (b) launcher URL composition that handles trailing slashes, pre-existing
// query params, and correct encoding of the SSE endpoint.
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import { composeLauncherUrl, resolvePetrinautBaseUrl } from './petrinaut-launcher-url.js';

describe('resolvePetrinautBaseUrl', () => {
  it('returns the CLI flag value when both CLI and env are set (CLI wins)', () => {
    const result = resolvePetrinautBaseUrl({
      cliFlag: 'https://cli.example/petrinaut',
      env: { PETRINAUT_BASE_URL: 'https://env.example/petrinaut' },
    });
    expect(result).toEqual({ baseUrl: 'https://cli.example/petrinaut' });
  });

  it('returns the env value when no CLI flag is set', () => {
    const result = resolvePetrinautBaseUrl({
      cliFlag: undefined,
      env: { PETRINAUT_BASE_URL: 'https://env.example/petrinaut' },
    });
    expect(result).toEqual({ baseUrl: 'https://env.example/petrinaut' });
  });

  it('returns the locked error message when neither CLI nor env is set', () => {
    const result = resolvePetrinautBaseUrl({ cliFlag: undefined, env: {} });
    expect(result).toEqual({
      error: 'Petrinaut base URL required: set PETRINAUT_BASE_URL in .env or pass --petrinaut-base-url=<url>',
    });
  });

  it('treats empty-string CLI flag and empty-string env as unset', () => {
    const result = resolvePetrinautBaseUrl({ cliFlag: '', env: { PETRINAUT_BASE_URL: '' } });
    expect(result).toMatchObject({ error: expect.stringContaining('PETRINAUT_BASE_URL') });
  });
});

describe('composeLauncherUrl', () => {
  it('composes runId + mode=actual + sse query params on a bare base URL', () => {
    const url = composeLauncherUrl({
      baseUrl: 'https://petrinaut.example/',
      runId: 'run_abc',
      streamUrl: 'http://127.0.0.1:51234/stream',
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('runId')).toBe('run_abc');
    expect(parsed.searchParams.get('mode')).toBe('actual');
    expect(parsed.searchParams.get('sse')).toBe('http://127.0.0.1:51234/stream');
  });

  it('preserves pre-existing query params on the base URL', () => {
    const url = composeLauncherUrl({
      baseUrl: 'https://petrinaut.example/import?theme=dark',
      runId: 'run_abc',
      streamUrl: 'http://127.0.0.1:51234/stream',
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('theme')).toBe('dark');
    expect(parsed.searchParams.get('runId')).toBe('run_abc');
    expect(parsed.searchParams.get('mode')).toBe('actual');
  });

  it('URL-encodes the sse parameter so a URL value round-trips cleanly', () => {
    const streamUrl = 'http://127.0.0.1:51234/stream?x=1&y=2';
    const url = composeLauncherUrl({
      baseUrl: 'https://petrinaut.example/',
      runId: 'run_abc',
      streamUrl,
    });
    // Raw query string must contain the encoded form, not the raw '&'.
    expect(url).toContain('sse=http%3A%2F%2F127.0.0.1%3A51234%2Fstream%3Fx%3D1%26y%3D2');
    // And round-trips through URL parsing.
    expect(new URL(url).searchParams.get('sse')).toBe(streamUrl);
  });

  it('handles baseUrl with and without trailing slash identically (composition is path-preserving)', () => {
    const a = composeLauncherUrl({
      baseUrl: 'https://petrinaut.example/import',
      runId: 'r',
      streamUrl: 'http://127.0.0.1:9/stream',
    });
    const b = composeLauncherUrl({
      baseUrl: 'https://petrinaut.example/import/',
      runId: 'r',
      streamUrl: 'http://127.0.0.1:9/stream',
    });
    // Same path, same query — trailing slash on the path is the only diff.
    const parsedA = new URL(a);
    const parsedB = new URL(b);
    expect(parsedA.searchParams.toString()).toBe(parsedB.searchParams.toString());
    expect(parsedA.host).toBe(parsedB.host);
  });
});
