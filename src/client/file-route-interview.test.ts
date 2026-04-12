// @vitest-environment node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('file-route interview ownership', () => {
  it('keeps the interview workspace file route thin while the generated tree owns the route entry', () => {
    const interviewRouteSource = readRepoFile('src/client/routes/project.$id.tsx');
    const generatedRouteTreeSource = readRepoFile('src/client/routeTree.gen.ts');
    const workspaceLoaderSource = readRepoFile('src/client/workspace/workspace-loader.ts');

    expect(interviewRouteSource).toContain("createFileRoute('/project/$id')");
    expect(interviewRouteSource).toContain('fetchInterviewWorkspaceLoaderData');
    expect(interviewRouteSource).toContain('InterviewWorkspace');
    expect(interviewRouteSource).toContain('InterviewWorkspaceSkeleton');

    expect(workspaceLoaderSource).toContain('fetchInterviewWorkspaceLoaderData');

    expect(generatedRouteTreeSource).toContain("'/project/$id'");
    expect(generatedRouteTreeSource).toContain("'./routes/project.$id'");
  });
});
