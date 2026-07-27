// ---------------------------------------------------------------------------
// Pure URL resolution + launcher URL composition.
//
// Two pure functions; no fs, no env reads (env is passed in), no process exits.
// Covers (a) multi-tier Petrinaut URL resolution (CLI > env > hard fail) and
// (b) launcher URL composition that handles trailing slashes, pre-existing
// query params, and correct encoding of the SSE endpoint.
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import { composeLauncherUrl, resolvePetrinautUrl } from './petrinaut-launcher-url.js';

describe('resolvePetrinautUrl', () => {
  it('returns the CLI flag value when both CLI and env are set (CLI wins)', () => {
    const result = resolvePetrinautUrl({
      cliFlag: 'https://cli.example/brunch',
      env: { PETRINAUT_URL: 'https://env.example/brunch' },
    });
    expect(result).toEqual({ url: 'https://cli.example/brunch' });
  });

  it('returns the env value when no CLI flag is set', () => {
    const result = resolvePetrinautUrl({
      cliFlag: undefined,
      env: { PETRINAUT_URL: 'https://env.example/brunch' },
    });
    expect(result).toEqual({ url: 'https://env.example/brunch' });
  });

  it('returns the locked error message when neither CLI nor env is set', () => {
    const result = resolvePetrinautUrl({ cliFlag: undefined, env: {} });
    expect(result).toEqual({
      error: 'Petrinaut URL required: set PETRINAUT_URL in .env or pass --petrinaut-url=<url>',
    });
  });

  it('treats empty-string CLI flag and empty-string env as unset', () => {
    const result = resolvePetrinautUrl({ cliFlag: '', env: { PETRINAUT_URL: '' } });
    expect(result).toMatchObject({ error: expect.stringContaining('PETRINAUT_URL') });
  });

  it('rejects relative or non-http URLs before launcher composition', () => {
    expect(resolvePetrinautUrl({ cliFlag: 'localhost:3000', env: {} })).toEqual({
      error: 'Petrinaut URL must be an absolute http(s) URL: set PETRINAUT_URL or pass --petrinaut-url=<url>',
    });
    expect(
      resolvePetrinautUrl({
        cliFlag: undefined,
        env: { PETRINAUT_URL: 'file:///tmp/petrinaut.html' },
      }),
    ).toMatchObject({ error: expect.stringContaining('absolute http(s) URL') });
  });
});

describe('composeLauncherUrl', () => {
  it('composes runId + sse query params on a bare Petrinaut URL (no mode param)', () => {
    const url = composeLauncherUrl({
      petrinautUrl: 'https://petrinaut.example/',
      runId: 'run_abc',
      streamUrl: 'http://127.0.0.1:51234/stream',
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('runId')).toBe('run_abc');
    expect(parsed.searchParams.get('sse')).toBe('http://127.0.0.1:51234/stream');
    // `mode` is dropped — the shipped Petrinaut consumer ignores it.
    expect(parsed.searchParams.has('mode')).toBe(false);
  });

  it('preserves pre-existing query params and the path on the Petrinaut URL', () => {
    const url = composeLauncherUrl({
      petrinautUrl: 'https://petrinaut.example/brunch?theme=dark',
      runId: 'run_abc',
      streamUrl: 'http://127.0.0.1:51234/stream',
    });
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/brunch');
    expect(parsed.searchParams.get('theme')).toBe('dark');
    expect(parsed.searchParams.get('runId')).toBe('run_abc');
    expect(parsed.searchParams.has('mode')).toBe(false);
  });

  it('URL-encodes the sse parameter so a URL value round-trips cleanly', () => {
    const streamUrl = 'http://127.0.0.1:51234/stream?x=1&y=2';
    const url = composeLauncherUrl({
      petrinautUrl: 'https://petrinaut.example/',
      runId: 'run_abc',
      streamUrl,
    });
    // Raw query string must contain the encoded form, not the raw '&'.
    expect(url).toContain('sse=http%3A%2F%2F127.0.0.1%3A51234%2Fstream%3Fx%3D1%26y%3D2');
    // And round-trips through URL parsing.
    expect(new URL(url).searchParams.get('sse')).toBe(streamUrl);
  });

  it('handles a URL with and without trailing slash identically (composition is path-preserving)', () => {
    const a = composeLauncherUrl({
      petrinautUrl: 'https://petrinaut.example/brunch',
      runId: 'r',
      streamUrl: 'http://127.0.0.1:9/stream',
    });
    const b = composeLauncherUrl({
      petrinautUrl: 'https://petrinaut.example/brunch/',
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
