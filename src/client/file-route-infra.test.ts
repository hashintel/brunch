// @vitest-environment node

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('file-route infrastructure', () => {
  it('wires the file-route build pipeline without cutting runtime routing over yet', () => {
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
    const manualRouterSource = readRepoFile('src/client/router.tsx');

    expect(packageJson.devDependencies?.['@tanstack/router-plugin']).toBeTruthy();

    expect(viteConfigSource).toContain("from '@tanstack/router-plugin/vite'");
    expect(viteConfigSource).toContain("routesDirectory: './src/client/file-routes'");
    expect(viteConfigSource).toContain("generatedRouteTree: './src/client/routeTree.gen.ts'");
    expect(viteConfigSource).toContain("target: 'react'");
    expect(viteConfigSource.indexOf('tanstackRouter(')).toBeGreaterThan(-1);
    expect(viteConfigSource.indexOf('tanstackRouter(')).toBeLessThan(viteConfigSource.indexOf('react()'));

    expect(oxlintConfig.ignorePatterns).toContain('src/client/routeTree.gen.ts');
    expect(oxfmtConfig.ignorePatterns).toContain('src/client/routeTree.gen.ts');

    expect(existsSync(join(process.cwd(), 'src/client/file-routes'))).toBe(true);
    expect(existsSync(join(process.cwd(), 'src/client/file-routes/__root.tsx'))).toBe(true);
    expect(generatedRouteTreeSource).toContain("from './file-routes/__root'");
    expect(manualRouterSource).not.toContain('routeTree.gen');
  });
});
