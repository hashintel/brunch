// @vitest-environment node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('file-route dashboard ownership', () => {
  it('keeps the dashboard file route thin while the generated tree owns the route entry', () => {
    const dashboardRouteSource = readRepoFile('src/client/routes/index.tsx');
    const fileRouteRootSource = readRepoFile('src/client/routes/__root.tsx');
    const projectListRouteSource = readRepoFile('src/client/routes/-project-list.tsx');
    const routeRootSource = readRepoFile('src/client/routes/-route-root.tsx');
    const generatedRouteTreeSource = readRepoFile('src/client/routeTree.gen.ts');

    expect(dashboardRouteSource).toContain("createFileRoute('/')");
    expect(dashboardRouteSource).toContain('fetchSpecificationListLoaderData');
    expect(dashboardRouteSource).toContain('component: SpecificationList');

    expect(projectListRouteSource).toContain("fetch('/api/specifications')");
    expect(projectListRouteSource).toContain('useCreateSpecificationMutation');
    expect(projectListRouteSource).toContain("navigate({ to: '/specification/$id'");
    expect(routeRootSource).toContain('Outlet');
    expect(routeRootSource).toContain('BrunchBrand');
    expect(routeRootSource).toContain('__APP_VERSION__');
    expect(fileRouteRootSource).toContain('fetchAppConfig');

    expect(generatedRouteTreeSource).toContain("'/'");
    expect(generatedRouteTreeSource).toContain("'./routes/index'");
  });
});
