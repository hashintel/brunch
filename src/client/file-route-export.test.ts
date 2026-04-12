// @vitest-environment node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('file-route export staging', () => {
  it('adds the export preview file route without cutting runtime bootstrapping over yet', () => {
    const exportRouteSource = readRepoFile('src/client/file-routes/project.$id.export.tsx');
    const generatedRouteTreeSource = readRepoFile('src/client/routeTree.gen.ts');
    const manualRouterSource = readRepoFile('src/client/router.tsx');
    const exportLoaderSource = readRepoFile('src/client/routes/export-loader.ts');
    const exportPreviewScreenSource = readRepoFile('src/client/screens/ExportPreviewScreen.tsx');

    expect(exportRouteSource).toContain("createFileRoute('/project/$id/export')");
    expect(exportRouteSource).toContain('fetchExportPreviewLoaderData');
    expect(exportRouteSource).toContain('ExportPreview');

    expect(exportLoaderSource).toContain('fetchExportPreviewLoaderData');
    expect(exportPreviewScreenSource).toContain('to="/project/$id/knowledge"');
    expect(manualRouterSource).toContain("path: '/project/$id/export'");
    expect(manualRouterSource).toContain('component: ExportPreview');

    expect(generatedRouteTreeSource).toContain("'/project/$id/export'");
    expect(generatedRouteTreeSource).toContain("'./file-routes/project.$id.export'");
    expect(manualRouterSource).not.toContain('routeTree.gen');
  });
});
