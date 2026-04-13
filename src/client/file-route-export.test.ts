// @vitest-environment node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('file-route export ownership', () => {
  it('keeps the export file route thin with an inline loader while the generated tree owns the route entry', () => {
    const exportRouteSource = readRepoFile('src/client/routes/project/$id/export.tsx');
    const exportPreviewSource = readRepoFile('src/client/routes/project/$id/-export-preview.tsx');
    const generatedRouteTreeSource = readRepoFile('src/client/routeTree.gen.ts');

    expect(exportRouteSource).toContain("createFileRoute('/project/$id/export')");
    expect(exportRouteSource).toContain('fetchExportLoaderData');
    expect(exportRouteSource).toContain('ExportPreview');

    expect(exportPreviewSource).toContain('to="/project/$id/framing"');

    expect(generatedRouteTreeSource).toContain("'/project/$id/export'");
    expect(generatedRouteTreeSource).toContain("from './routes/project/$id/export'");
  });
});
