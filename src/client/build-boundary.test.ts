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
  'src/client/routes/project.$id.tsx?tsr-split=component',
  'src/client/routes/project_.$id.export.tsx?tsr-split=component',
  'src/client/routes/project_.$id.knowledge.tsx?tsr-split=component',
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

    expect(readableBuild.entryFile).toContain('/project/$id');
    expect(readableBuild.entryFile).not.toContain('streamdown');
    expect(readableBuild.entryFile).not.toContain('createHighlighter');
    expect(readableBuild.entry.dynamicImports?.slice().sort()).toEqual(
      [...routeComponentManifestIds, ...lazyThirdPartyManifestIds].sort(),
    );
    expect(new Set(routeComponentChunkFiles).size).toBe(routeComponentChunkFiles.length);

    // streamdown is lazy-loaded for progressive markdown rendering
    const richRenderingChunk = Object.values(readableBuild.manifest).find((chunk) => {
      if (!chunk.file || chunk.file === readableBuild.entry.file) {
        return false;
      }

      const chunkSource = readFileSync(join(readableBuild.outDir, chunk.file), 'utf8');
      return chunkSource.includes('streamdown');
    });

    expect(richRenderingChunk?.file).toBeTruthy();

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

    const minifiedBuild = await buildClient({ minify: true });
    expect(statSync(minifiedBuild.entryPath).size).toBeLessThan(1_050_000);
  }, 30_000);
});
