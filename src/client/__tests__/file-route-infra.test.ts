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
    const viteClientConfigSource = readRepoFile('config/vite-client.ts');
    const oxlintConfig = JSON.parse(readRepoFile('.oxlintrc.json')) as {
      ignorePatterns?: string[];
    };
    const oxfmtConfig = JSON.parse(readRepoFile('.oxfmtrc.json')) as {
      ignorePatterns?: string[];
    };
    const generatedRouteTreeSource = readRepoFile('src/client/routeTree.gen.ts');
    const routerSource = readRepoFile('src/client/router.tsx');

    expect(packageJson.devDependencies?.['@tanstack/router-plugin']).toBeTruthy();

    expect(viteClientConfigSource).toContain("from '@tanstack/router-plugin/vite'");
    expect(viteClientConfigSource).toContain('autoCodeSplitting: true');
    expect(viteClientConfigSource).toContain("routesDirectory: resolve(rootDir, 'src/client/routes')");
    expect(viteClientConfigSource).toContain(
      "generatedRouteTree: resolve(rootDir, 'src/client/routeTree.gen.ts')",
    );
    expect(viteClientConfigSource).toContain("routeFileIgnorePattern: '.*\\\\.test\\\\.(ts|tsx)$'");
    expect(viteClientConfigSource).toContain("target: 'react'");
    expect(viteConfigSource).toContain('cacheDir: getViteCacheDir(command, process.argv, mode)');
    expect(viteClientConfigSource).toContain('port: defaultDevServerPort');
    expect(viteClientConfigSource).toContain('strictPort: true');
    expect(viteClientConfigSource.indexOf('tanstackRouter(')).toBeGreaterThan(-1);
    expect(viteClientConfigSource.indexOf('tanstackRouter(')).toBeLessThan(
      viteClientConfigSource.indexOf('react()'),
    );

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

    // Directory-based canonical phase route imports
    expect(generatedRouteTreeSource).toContain("from './routes/specification/$id/route'");
    expect(generatedRouteTreeSource).toContain("from './routes/specification/$id/index'");
    expect(generatedRouteTreeSource).toContain("from './routes/specification/$id/export'");
    expect(generatedRouteTreeSource).toContain("from './routes/specification/$id/_view/route'");
    expect(generatedRouteTreeSource).toContain("from './routes/specification/$id/_view/grounding'");
    expect(generatedRouteTreeSource).toContain("from './routes/specification/$id/_view/elicitation'");
    expect(generatedRouteTreeSource).toContain("from './routes/specification/$id/_view/requirements-review'");
    expect(generatedRouteTreeSource).toContain("from './routes/specification/$id/_view/acceptance-review'");

    // Route IDs confirm nesting hierarchy
    expect(generatedRouteTreeSource).toContain("id: '/specification/$id'");
    expect(generatedRouteTreeSource).toContain("id: '/_view'");
    expect(generatedRouteTreeSource).toContain("id: '/grounding'");

    // No old flat-file route imports remain
    expect(generatedRouteTreeSource).not.toContain("from './routes/project.$id'");
    expect(generatedRouteTreeSource).not.toContain("from './routes/project_.$id");
  });

  it('does not keep the retired framing compatibility route in the generated tree', () => {
    const generatedRouteTreeSource = readRepoFile('src/client/routeTree.gen.ts');

    expect(generatedRouteTreeSource).not.toContain("from './routes/specification/$id/_view/framing'");
    expect(generatedRouteTreeSource).not.toContain("id: '/framing'");
    expect(existsSync(join(process.cwd(), 'src/client/routes/specification/$id/_view/framing.tsx'))).toBe(
      false,
    );
  });

  it('keeps directory-based route files and colocated support files in place', () => {
    // Layout routes
    expect(existsSync(join(process.cwd(), 'src/client/routes/specification/$id/route.tsx'))).toBe(true);
    expect(existsSync(join(process.cwd(), 'src/client/routes/specification/$id/_view/route.tsx'))).toBe(true);

    // Canonical phase routes
    expect(existsSync(join(process.cwd(), 'src/client/routes/specification/$id/_view/grounding.tsx'))).toBe(
      true,
    );
    expect(existsSync(join(process.cwd(), 'src/client/routes/specification/$id/_view/elicitation.tsx'))).toBe(
      true,
    );
    expect(
      existsSync(join(process.cwd(), 'src/client/routes/specification/$id/_view/requirements-review.tsx')),
    ).toBe(true);
    expect(
      existsSync(join(process.cwd(), 'src/client/routes/specification/$id/_view/acceptance-review.tsx')),
    ).toBe(true);

    // Colocated support files (prefixed with -)
    expect(
      existsSync(join(process.cwd(), 'src/client/routes/specification/$id/_view/-interview-view.tsx')),
    ).toBe(true);
    expect(existsSync(join(process.cwd(), 'src/client/routes/specification/$id/-export-preview.tsx'))).toBe(
      true,
    );

    // Legacy project-route aliases removed
    expect(existsSync(join(process.cwd(), 'src/client/routes/project/$id/route.tsx'))).toBe(false);
    expect(existsSync(join(process.cwd(), 'src/client/routes/project/$id/_view/route.tsx'))).toBe(false);
    expect(existsSync(join(process.cwd(), 'src/client/routes/project/$id/export.tsx'))).toBe(false);

    // Old flat-file routes removed
    expect(existsSync(join(process.cwd(), 'src/client/routes/project.$id.tsx'))).toBe(false);
    expect(existsSync(join(process.cwd(), 'src/client/routes/project_.$id.knowledge.tsx'))).toBe(false);
    expect(existsSync(join(process.cwd(), 'src/client/routes/project_.$id.export.tsx'))).toBe(false);
  });
});
