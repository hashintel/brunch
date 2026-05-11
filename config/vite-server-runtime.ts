import { cpSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { resolve } from 'node:path';

import type { UserConfig } from 'vite';

import { serverRuntimeBuildMode } from './vite-dev-server';

type PackageMetadata = {
  dependencies?: Record<string, string>;
};

const nodeBuiltinModuleIds = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleId) => `node:${moduleId}`),
]);

const createRuntimeExternalPredicate = (packageMetadata: PackageMetadata) => {
  const runtimeDependencyIds = Object.keys(packageMetadata.dependencies ?? {});

  return (moduleId: string) =>
    nodeBuiltinModuleIds.has(moduleId) ||
    runtimeDependencyIds.some(
      (dependencyId) => moduleId === dependencyId || moduleId.startsWith(`${dependencyId}/`),
    );
};

export const isServerRuntimeBuild = (command: 'build' | 'serve', mode: string) =>
  command === 'build' && mode === serverRuntimeBuildMode;

export const createServerRuntimeConfig = <T extends object>({
  packageMetadata,
  rootDir,
  sharedConfig,
}: {
  packageMetadata: PackageMetadata;
  rootDir: string;
  sharedConfig: T;
}): T & UserConfig => ({
  ...sharedConfig,
  plugins: [
    {
      name: 'copy-server-prompt-assets',
      closeBundle() {
        cpSync(resolve(rootDir, 'src/server/prompts'), resolve(rootDir, 'dist/server/prompts'), {
          recursive: true,
        });
      },
    },
  ],
  build: {
    copyPublicDir: false,
    emptyOutDir: false,
    minify: false,
    outDir: resolve(rootDir, 'dist/server'),
    rollupOptions: {
      external: createRuntimeExternalPredicate(packageMetadata),
      output: {
        chunkFileNames: 'chunks/[name]-[hash].js',
        entryFileNames: 'cli.js',
        format: 'es',
      },
    },
    ssr: resolve(rootDir, 'src/server/cli.ts'),
    target: 'node22',
  },
});
