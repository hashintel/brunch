// @vitest-environment node

import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { build } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';

type BuildManifestChunk = {
  dynamicImports?: string[];
  file?: string;
  isDynamicEntry?: boolean;
  isEntry?: boolean;
  src?: string;
};

const routeComponentManifestIds = [
  'src/client/routes/index.tsx?tsr-split=component',
  'src/client/routes/specification/$id/route.tsx?tsr-split=component',
  'src/client/routes/specification/$id/export.tsx?tsr-split=component',
  'src/client/routes/specification/$id/graph.tsx?tsr-split=component',
  'src/client/routes/specification/$id/_view/route.tsx?tsr-split=component',
  'src/client/routes/specification/$id/_view/grounding.tsx?tsr-split=component',
  'src/client/routes/specification/$id/_view/elicitation.tsx?tsr-split=component',
  'src/client/routes/specification/$id/_view/requirements-review.tsx?tsr-split=component',
  'src/client/routes/specification/$id/_view/acceptance-review.tsx?tsr-split=component',
] as const;

const lazyThirdPartyManifestIds = ['node_modules/agentation/dist/index.mjs'] as const;

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
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, BuildManifestChunk>;
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

  it('keeps rich markdown rendering lazy and preserves route-level code splitting in the production build', async () => {
    const readableBuild = await buildClient({ minify: false });
    const routeComponentChunkFiles = routeComponentManifestIds.map((manifestId) => {
      const chunk = readableBuild.manifest[manifestId];

      expect(chunk, `${manifestId} missing from manifest`).toBeTruthy();
      expect(chunk?.isDynamicEntry, `${manifestId} should stay lazy-loaded`).toBe(true);
      expect(chunk?.file).toBeTruthy();

      return chunk!.file!;
    });

    expect(readableBuild.entryFile).toContain('/specification/$id');
    expect(readableBuild.entryFile).not.toContain('streamdown');
    expect(readableBuild.entryFile).not.toContain('createHighlighter');
    expect(readableBuild.entry.dynamicImports?.slice().sort()).toEqual(
      [...routeComponentManifestIds, ...lazyThirdPartyManifestIds].sort(),
    );
    // Phase routes may share chunks (same InterviewWorkspace component), so unique count may be less
    expect(new Set(routeComponentChunkFiles).size).toBeGreaterThanOrEqual(4);

    // streamdown must stay out of the entry bundle. It may be emitted as a lazy chunk
    // when a production surface still reaches rich markdown rendering, or omitted entirely
    // if no shipped route references that capability anymore.
    const richRenderingChunks = Object.values(readableBuild.manifest).filter((chunk) => {
      if (!chunk.file || chunk.file === readableBuild.entry.file) {
        return false;
      }

      const chunkSource = readFileSync(join(readableBuild.outDir, chunk.file), 'utf8');
      return chunkSource.includes('streamdown');
    });

    expect(richRenderingChunks.length).toBeLessThanOrEqual(1);

    // shiki must not appear in any chunk — tool JSON uses plain code rendering
    const allChunkSources = Object.values(readableBuild.manifest)
      .filter((chunk) => chunk.file)
      .map((chunk) => ({
        file: chunk.file!,
        source: readFileSync(join(readableBuild.outDir, chunk.file!), 'utf8'),
      }));

    for (const { file, source } of allChunkSources) {
      expect(source, `shiki found in ${file}`).not.toContain('createHighlighter');
    }

    // GraphView must be in its own chunk, not inlined into ViewLayout's route chunk
    const viewLayoutChunk =
      readableBuild.manifest['src/client/routes/specification/$id/_view/route.tsx?tsr-split=component'];
    expect(viewLayoutChunk?.file).toBeTruthy();
    const viewLayoutChunkSource = readFileSync(join(readableBuild.outDir, viewLayoutChunk!.file!), 'utf8');
    expect(viewLayoutChunkSource, 'GraphView should not be inlined in ViewLayout chunk').not.toContain(
      'data-graph-view',
    );

    // GraphView should exist as a separate dynamic chunk
    const graphViewChunk = Object.values(readableBuild.manifest).find((chunk) => {
      if (!chunk.file || chunk.file === readableBuild.entry.file) {
        return false;
      }

      const chunkSource = readFileSync(join(readableBuild.outDir, chunk.file), 'utf8');
      return chunkSource.includes('data-graph-view');
    });

    expect(graphViewChunk?.file, 'GraphView must be in a separate chunk').toBeTruthy();

    const minifiedBuild = await buildClient({ minify: true });
    expect(statSync(minifiedBuild.entryPath).size).toBeLessThan(1_050_000);
  }, 30_000);
});
