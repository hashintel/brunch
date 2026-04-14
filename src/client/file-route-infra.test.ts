// @vitest-environment node

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('generated route runtime ownership', () => {
  it('keeps generated routing configured and bootstrapped from the managed route tree', () => {
    const packageJson = JSON.parse(readRepoFile('package.json')) as {
      devDependencies?: Record<string, string>;
    };
    const viteConfigSource = readRepoFile('vite.config.ts');
    const oxlintConfig = JSON.parse(readRepoFile('.oxlintrc.json')) as {
      ignorePatterns?: string[];
    };
    const oxfmtConfig = JSON.parse(readRepoFile('.oxfmtrc.json')) as {
      ignorePatterns?: string[];
    };
    const generatedRouteTreeSource = readRepoFile('src/client/routeTree.gen.ts');
    const routerSource = readRepoFile('src/client/router.tsx');

    expect(packageJson.devDependencies?.['@tanstack/router-plugin']).toBeTruthy();

    expect(viteConfigSource).toContain("from '@tanstack/router-plugin/vite'");
    expect(viteConfigSource).toContain('autoCodeSplitting: true');
    expect(viteConfigSource).toContain("routesDirectory: resolve(__dirname, 'src/client/routes')");
    expect(viteConfigSource).toContain(
      "generatedRouteTree: resolve(__dirname, 'src/client/routeTree.gen.ts')",
    );
    expect(viteConfigSource).toContain("routeFileIgnorePattern: '.*\\\\.test\\\\.(ts|tsx)$'");
    expect(viteConfigSource).toContain("target: 'react'");
    expect(viteConfigSource).toContain('cacheDir: getViteCacheDir(command, process.argv)');
    expect(viteConfigSource).toContain('port: defaultDevServerPort');
    expect(viteConfigSource).toContain('strictPort: true');
    expect(viteConfigSource.indexOf('tanstackRouter(')).toBeGreaterThan(-1);
    expect(viteConfigSource.indexOf('tanstackRouter(')).toBeLessThan(viteConfigSource.indexOf('react()'));

    expect(oxlintConfig.ignorePatterns).toContain('src/client/routeTree.gen.ts');
    expect(oxfmtConfig.ignorePatterns).toContain('src/client/routeTree.gen.ts');

    expect(existsSync(join(process.cwd(), 'src/client/routes'))).toBe(true);
    expect(existsSync(join(process.cwd(), 'src/client/routes/__root.tsx'))).toBe(true);
    expect(generatedRouteTreeSource).toContain("from './routes/__root'");
    expect(routerSource).toContain("from './routeTree.gen.js'");
    expect(routerSource).toContain('createRouter({ routeTree })');
    expect(routerSource).not.toContain('createRoute(');
    expect(routerSource).not.toContain('createRootRoute(');
  });

  it('uses directory-based nesting with pathless _view layout route', () => {
    const generatedRouteTreeSource = readRepoFile('src/client/routeTree.gen.ts');

    // Directory-based route imports
    expect(generatedRouteTreeSource).toContain("from './routes/project/$id/route'");
    expect(generatedRouteTreeSource).toContain("from './routes/project/$id/index'");
    expect(generatedRouteTreeSource).toContain("from './routes/project/$id/export'");
    expect(generatedRouteTreeSource).toContain("from './routes/project/$id/_view/route'");
    expect(generatedRouteTreeSource).toContain("from './routes/project/$id/_view/framing'");
    expect(generatedRouteTreeSource).toContain("from './routes/project/$id/_view/elicitation'");
    expect(generatedRouteTreeSource).toContain("from './routes/project/$id/_view/requirements-review'");
    expect(generatedRouteTreeSource).toContain("from './routes/project/$id/_view/acceptance-review'");

    // Route IDs confirm nesting hierarchy
    expect(generatedRouteTreeSource).toContain("id: '/project/$id'");
    expect(generatedRouteTreeSource).toContain("id: '/_view'");
    expect(generatedRouteTreeSource).toContain("id: '/framing'");

    // No old flat-file route imports remain
    expect(generatedRouteTreeSource).not.toContain("from './routes/project.$id'");
    expect(generatedRouteTreeSource).not.toContain("from './routes/project_.$id");
  });

  it('keeps directory-based route files and colocated support files in place', () => {
    // Layout routes
    expect(existsSync(join(process.cwd(), 'src/client/routes/project/$id/route.tsx'))).toBe(true);
    expect(existsSync(join(process.cwd(), 'src/client/routes/project/$id/_view/route.tsx'))).toBe(true);

    // Phase routes
    expect(existsSync(join(process.cwd(), 'src/client/routes/project/$id/_view/framing.tsx'))).toBe(true);
    expect(existsSync(join(process.cwd(), 'src/client/routes/project/$id/_view/elicitation.tsx'))).toBe(true);
    expect(
      existsSync(join(process.cwd(), 'src/client/routes/project/$id/_view/requirements-review.tsx')),
    ).toBe(true);
    expect(existsSync(join(process.cwd(), 'src/client/routes/project/$id/_view/acceptance-review.tsx'))).toBe(
      true,
    );

    // Colocated support files (prefixed with -)
    expect(existsSync(join(process.cwd(), 'src/client/routes/project/$id/_view/-interview-view.tsx'))).toBe(
      true,
    );
    expect(existsSync(join(process.cwd(), 'src/client/routes/project/$id/-export-preview.tsx'))).toBe(true);

    // Old flat-file routes removed
    expect(existsSync(join(process.cwd(), 'src/client/routes/project.$id.tsx'))).toBe(false);
    expect(existsSync(join(process.cwd(), 'src/client/routes/project_.$id.knowledge.tsx'))).toBe(false);
    expect(existsSync(join(process.cwd(), 'src/client/routes/project_.$id.export.tsx'))).toBe(false);
  });
});
