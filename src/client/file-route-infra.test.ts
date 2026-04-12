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
    expect(viteConfigSource).toContain("routesDirectory: './src/client/routes'");
    expect(viteConfigSource).toContain("generatedRouteTree: './src/client/routeTree.gen.ts'");
    expect(viteConfigSource).toContain("routeFileIgnorePattern: '.*\\\\.test\\\\.(ts|tsx)$'");
    expect(viteConfigSource).toContain("target: 'react'");
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
});
