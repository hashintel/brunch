// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { defaultDevServerPort, getViteCacheDir, resolveDevServerPort } from '../../../vite.config';

describe('vite dev server hardening', () => {
  it('falls back to the default frontend port when no port flag is provided', () => {
    expect(resolveDevServerPort(['vite'])).toBe(defaultDevServerPort);
  });

  it('parses both inline and positional port flags', () => {
    expect(resolveDevServerPort(['vite', '--host', '127.0.0.1', '--port', '4173'])).toBe(4173);
    expect(resolveDevServerPort(['vite', '--port=4174'])).toBe(4174);
  });

  it('isolates the optimize-deps cache by serve port and keeps build cache stable', () => {
    expect(getViteCacheDir('serve', ['vite'])).toContain('node_modules/.vite-5173');
    expect(getViteCacheDir('serve', ['vite', '--port', '4173'])).toContain('node_modules/.vite-4173');
    expect(getViteCacheDir('build', ['vite', 'build'])).toContain('node_modules/.vite-build');
  });
});
