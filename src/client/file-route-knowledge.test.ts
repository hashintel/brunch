// @vitest-environment node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('file-route knowledge staging', () => {
  it('adds the knowledge workspace file route without cutting runtime bootstrapping over yet', () => {
    const knowledgeRouteSource = readRepoFile('src/client/file-routes/project.$id.knowledge.tsx');
    const generatedRouteTreeSource = readRepoFile('src/client/routeTree.gen.ts');
    const manualRouterSource = readRepoFile('src/client/router.tsx');
    const workspaceLoaderSource = readRepoFile('src/client/workspace/workspace-loader.ts');

    expect(knowledgeRouteSource).toContain("createFileRoute('/project/$id/knowledge')");
    expect(knowledgeRouteSource).toContain('fetchKnowledgeWorkspaceLoaderData');
    expect(knowledgeRouteSource).toContain('KnowledgeWorkspace');
    expect(knowledgeRouteSource).toContain('KnowledgeWorkspaceSkeleton');

    expect(workspaceLoaderSource).toContain('fetchKnowledgeWorkspaceLoaderData');
    expect(manualRouterSource).toContain("path: '/project/$id/knowledge'");
    expect(manualRouterSource).toContain('pendingComponent: KnowledgeWorkspaceSkeleton');

    expect(generatedRouteTreeSource).toContain("'/project/$id/knowledge'");
    expect(generatedRouteTreeSource).toContain("'./file-routes/project.$id.knowledge'");
    expect(manualRouterSource).not.toContain('routeTree.gen');
  });
});
