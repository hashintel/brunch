// @vitest-environment node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('file-route dashboard staging', () => {
  it('adds the dashboard file route without cutting runtime bootstrapping over yet', () => {
    const dashboardRouteSource = readRepoFile('src/client/file-routes/index.tsx');
    const fileRouteRootSource = readRepoFile('src/client/file-routes/__root.tsx');
    const generatedRouteTreeSource = readRepoFile('src/client/routeTree.gen.ts');
    const manualRouterSource = readRepoFile('src/client/router.tsx');
    const projectListLoaderSource = readRepoFile('src/client/routes/project-list-loader.ts');
    const routeRootSource = readRepoFile('src/client/routes/RouteRoot.tsx');

    expect(dashboardRouteSource).toContain("createFileRoute('/')");
    expect(dashboardRouteSource).toContain('fetchProjectListLoaderData');
    expect(dashboardRouteSource).toContain('ProjectListScreen');
    expect(dashboardRouteSource).toContain("navigate({ to: '/project/$id'");

    expect(projectListLoaderSource).toContain("fetch('/api/projects')");
    expect(routeRootSource).toContain('Outlet');
    expect(fileRouteRootSource).toContain('component: RouteRoot');
    expect(manualRouterSource).toContain('component: RouteRoot');

    expect(generatedRouteTreeSource).toContain("'/'");
    expect(generatedRouteTreeSource).toContain("'./file-routes/index'");
    expect(manualRouterSource).not.toContain('routeTree.gen');
  });
});
