// @vitest-environment node

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { build } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';

describe('client build boundary', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it('keeps debug and rich markdown rendering out of the default client entrypoint', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'brunch-client-build-'));
    tempDirs.push(outDir);

    await build({
      build: {
        manifest: true,
        minify: false,
        outDir,
      },
      configFile: 'vite.config.ts',
      logLevel: 'silent',
    });

    const manifestPath = join(outDir, '.vite', 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<
      string,
      { file?: string; isEntry?: boolean }
    >;

    const entry = manifest['index.html'];
    expect(entry?.isEntry).toBe(true);
    expect(entry?.file).toBeTruthy();

    const entryFile = readFileSync(join(outDir, entry.file!), 'utf8');

    expect(entryFile).toContain('/debug');
    expect(entryFile).toContain('/project/$id');
    expect(entryFile).not.toContain('Component Debug');
    expect(entryFile).not.toContain('outer-loop testing');
    expect(entryFile).not.toContain('streamdown');
    expect(entryFile).not.toContain('createHighlighter');

    const richRenderingChunk = Object.values(manifest).find((chunk) => {
      if (!chunk.file || chunk.file === entry.file) {
        return false;
      }

      const chunkSource = readFileSync(join(outDir, chunk.file), 'utf8');
      return chunkSource.includes('streamdown');
    });

    expect(richRenderingChunk?.file).toBeTruthy();

    const highlighterChunk = Object.values(manifest).find((chunk) => {
      if (!chunk.file || chunk.file === entry.file) {
        return false;
      }

      const chunkSource = readFileSync(join(outDir, chunk.file), 'utf8');
      return chunkSource.includes('createHighlighter');
    });

    expect(highlighterChunk?.file).toBeTruthy();

    const debugChunk = Object.values(manifest).find((chunk) => {
      if (!chunk.file || chunk.file === entry.file) {
        return false;
      }

      const chunkSource = readFileSync(join(outDir, chunk.file), 'utf8');
      return chunkSource.includes('Component Debug');
    });

    expect(debugChunk?.file).toBeTruthy();
  }, 20_000);
});
