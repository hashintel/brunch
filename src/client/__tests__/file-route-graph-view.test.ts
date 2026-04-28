// @vitest-environment node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('file-route graph-view ownership', () => {
  it('keeps the canonical graph route file thin, with the structured-list view living in a peer file, and the generated tree owning the route entry', () => {
    const graphRouteSource = readRepoFile('src/client/routes/specification/$id/graph.tsx');
    const structuredListViewSource = readRepoFile(
      'src/client/routes/specification/$id/-structured-list-view.tsx',
    );
    const generatedRouteTreeSource = readRepoFile('src/client/routeTree.gen.ts');

    expect(graphRouteSource).toContain("createFileRoute('/specification/$id/graph')");
    expect(graphRouteSource).toContain('primeSpecificationEntitiesProjectWide');
    expect(graphRouteSource).toContain('StructuredListView');

    expect(structuredListViewSource).toContain('export function StructuredListView');
    expect(structuredListViewSource).toContain('data-graph-structured-list');
    expect(structuredListViewSource).toContain('data-graph-row');

    expect(generatedRouteTreeSource).toContain("'/specification/$id/graph'");
    expect(generatedRouteTreeSource).toContain("from './routes/specification/$id/graph'");
  });
});
