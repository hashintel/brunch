// @vitest-environment node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('file-route phase route ownership', () => {
  it('keeps the ProjectLayout route thin with the interview workspace loader', () => {
    const projectLayoutSource = readRepoFile('src/client/routes/project/$id/route.tsx');
    const workspaceLoaderSource = readRepoFile('src/client/workspace/workspace-loader.ts');
    const generatedRouteTreeSource = readRepoFile('src/client/routeTree.gen.ts');

    expect(projectLayoutSource).toContain("createFileRoute('/project/$id')");
    expect(projectLayoutSource).toContain('fetchInterviewWorkspaceLoaderData');
    expect(projectLayoutSource).toContain('Outlet');

    expect(workspaceLoaderSource).toContain('fetchInterviewWorkspaceLoaderData');

    expect(generatedRouteTreeSource).toContain("'/project/$id'");
    expect(generatedRouteTreeSource).toContain("from './routes/project/$id/route'");
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
