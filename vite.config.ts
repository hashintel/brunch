import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import { createClientConfig } from './config/vite-client';
import {
  defaultDevServerPort,
  getViteCacheDir as getViteCacheDirForRoot,
  resolveDevServerPort,
  serverRuntimeBuildMode,
} from './config/vite-dev-server';
import {
  copyServerPromptAssets,
  createServerRuntimeConfig,
  isServerRuntimeBuild,
} from './config/vite-server-runtime';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
  version?: string;
};

export { copyServerPromptAssets, defaultDevServerPort, resolveDevServerPort, serverRuntimeBuildMode };

export const getViteCacheDir = (command: 'build' | 'serve', argv: string[], mode?: string) =>
  getViteCacheDirForRoot(__dirname, command, argv, mode);

export default defineConfig(({ command, mode }) => {
  const enableCodeInspector = command === 'serve' && !process.env.VITEST;
  const enableReactScan = command === 'serve' && !process.env.VITEST;

  const sharedConfig = {
    cacheDir: getViteCacheDir(command, process.argv, mode),
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version ?? '0.0.0'),
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
      dedupe: ['react', 'react-dom'],
    },
    test: {
      include: ['src/**/*.test.{js,ts,jsx,tsx}', 'scripts/**/*.test.{js,ts,jsx,tsx}'],
    },
  };

  if (isServerRuntimeBuild(command, mode)) {
    return createServerRuntimeConfig({
      packageMetadata: packageJson,
      rootDir: __dirname,
      sharedConfig,
    });
  }

  return createClientConfig({
    enableCodeInspector,
    enableReactScan,
    env: process.env,
    rootDir: __dirname,
    sharedConfig,
  });
});
