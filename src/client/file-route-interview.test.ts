// @vitest-environment node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('file-route phase route ownership', () => {
  it('ProjectLayout route uses the split project-state loader and renders the sidebar', () => {
    const projectLayoutSource = readRepoFile('src/client/routes/project/$id/route.tsx');
    const generatedRouteTreeSource = readRepoFile('src/client/routeTree.gen.ts');

    expect(projectLayoutSource).toContain("createFileRoute('/project/$id')");
    expect(projectLayoutSource).toContain('fetchProjectLayoutLoaderData');
    expect(projectLayoutSource).toContain('PhaseNavigationSidebar');
    expect(projectLayoutSource).toContain('Outlet');

    expect(generatedRouteTreeSource).toContain("'/project/$id'");
    expect(generatedRouteTreeSource).toContain("from './routes/project/$id/route'");
  });

  it('ViewLayout route uses the split entity-data loader', () => {
    const viewLayoutSource = readRepoFile('src/client/routes/project/$id/_view/route.tsx');

    expect(viewLayoutSource).toContain("createFileRoute('/project/$id/_view')");
    expect(viewLayoutSource).toContain('fetchViewLayoutLoaderData');
    expect(viewLayoutSource).toContain('Outlet');
  });

  it('workspace-loader exports the split layout-level fetch functions', () => {
    const workspaceLoaderSource = readRepoFile('src/client/workspace/workspace-loader.ts');

    expect(workspaceLoaderSource).toContain('fetchProjectLayoutLoaderData');
    expect(workspaceLoaderSource).toContain('fetchViewLayoutLoaderData');
    // The combined fetchInterviewWorkspaceLoaderData should no longer exist
    expect(workspaceLoaderSource).not.toContain('fetchInterviewWorkspaceLoaderData');
  });

  it('keeps phase routes thin — each renders InterviewWorkspace via colocated support file', () => {
    const phaseRoutes = ['framing', 'elicitation', 'requirements-review', 'acceptance-review'];

    for (const phase of phaseRoutes) {
      const source = readRepoFile(`src/client/routes/project/$id/_view/${phase}.tsx`);
      expect(source, `${phase} route should use createFileRoute`).toContain('createFileRoute');
      expect(source, `${phase} route should render InterviewWorkspace`).toContain('InterviewWorkspace');
    }
  });
});
