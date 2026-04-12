// @vitest-environment node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('file-route knowledge ownership', () => {
  it('keeps the knowledge workspace file route thin while the generated tree owns the route entry', () => {
    const knowledgeRouteSource = readRepoFile('src/client/routes/project_.$id.knowledge.tsx');
    const generatedRouteTreeSource = readRepoFile('src/client/routeTree.gen.ts');
    const workspaceLoaderSource = readRepoFile('src/client/workspace/workspace-loader.ts');

    expect(knowledgeRouteSource).toContain("createFileRoute('/project_/$id/knowledge')");
    expect(knowledgeRouteSource).toContain('fetchKnowledgeWorkspaceLoaderData');
    expect(knowledgeRouteSource).toContain('KnowledgeWorkspace');
    expect(knowledgeRouteSource).toContain('KnowledgeWorkspaceSkeleton');

    expect(workspaceLoaderSource).toContain('fetchKnowledgeWorkspaceLoaderData');

    expect(generatedRouteTreeSource).toContain("'/project/$id/knowledge'");
    expect(generatedRouteTreeSource).toContain("'./routes/project_.$id.knowledge'");
  });
});
