// @vitest-environment node

import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
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

  const buildClient = async ({ minify }: { minify: boolean }) => {
    const outDir = mkdtempSync(join(tmpdir(), 'brunch-client-build-'));
    tempDirs.push(outDir);

    await build({
      build: {
        manifest: true,
        minify,
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

    return {
      entryFile: readFileSync(join(outDir, entry.file!), 'utf8'),
      entryPath: join(outDir, entry.file!),
      manifest,
      outDir,
      entry,
    };
  };

  it('keeps debug and rich markdown rendering out of the default client entrypoint', async () => {
    const readableBuild = await buildClient({ minify: false });

    expect(readableBuild.entryFile).toContain('/debug');
    expect(readableBuild.entryFile).toContain('/project/$id');
    expect(readableBuild.entryFile).not.toContain('Component Debug');
    expect(readableBuild.entryFile).not.toContain('outer-loop testing');
    expect(readableBuild.entryFile).not.toContain('streamdown');
    expect(readableBuild.entryFile).not.toContain('createHighlighter');

    const richRenderingChunk = Object.values(readableBuild.manifest).find((chunk) => {
      if (!chunk.file || chunk.file === readableBuild.entry.file) {
        return false;
      }

      const chunkSource = readFileSync(join(readableBuild.outDir, chunk.file), 'utf8');
      return chunkSource.includes('streamdown');
    });

    expect(richRenderingChunk?.file).toBeTruthy();

    const highlighterChunk = Object.values(readableBuild.manifest).find((chunk) => {
      if (!chunk.file || chunk.file === readableBuild.entry.file) {
        return false;
      }

      const chunkSource = readFileSync(join(readableBuild.outDir, chunk.file), 'utf8');
      return chunkSource.includes('createHighlighter');
    });

    expect(highlighterChunk?.file).toBeTruthy();

    const debugChunk = Object.values(readableBuild.manifest).find((chunk) => {
      if (!chunk.file || chunk.file === readableBuild.entry.file) {
        return false;
      }

      const chunkSource = readFileSync(join(readableBuild.outDir, chunk.file), 'utf8');
      return chunkSource.includes('Component Debug');
    });

    expect(debugChunk?.file).toBeTruthy();

    const minifiedBuild = await buildClient({ minify: true });
    expect(statSync(minifiedBuild.entryPath).size).toBeLessThan(950_000);
  }, 30_000);
});
