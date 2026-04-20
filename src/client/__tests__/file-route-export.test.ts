// @vitest-environment node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('file-route export ownership', () => {
  it('keeps the canonical export file route thin with an inline loader while the generated tree owns the route entry', () => {
    const exportRouteSource = readRepoFile('src/client/routes/specification/$id/export.tsx');
    const exportPreviewSource = readRepoFile('src/client/routes/specification/$id/-export-preview.tsx');
    const generatedRouteTreeSource = readRepoFile('src/client/routeTree.gen.ts');

    expect(exportRouteSource).toContain("createFileRoute('/specification/$id/export')");
    expect(exportRouteSource).toContain('fetchExportLoaderData');
    expect(exportRouteSource).toContain('ExportPreview');

    expect(exportPreviewSource).toContain('to="/specification/$id/grounding"');

    expect(generatedRouteTreeSource).toContain("'/specification/$id/export'");
    expect(generatedRouteTreeSource).toContain("from './routes/specification/$id/export'");
  });
});
