import { cpSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { agentTail } from 'agent-tail/vite';
import { codeInspectorPlugin } from 'code-inspector-plugin';
import type { PluginOption } from 'vite';
import { defineConfig } from 'vitest/config';

import { getBackendProxyTarget } from './src/server/runtime-config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
  version?: string;
};

export const defaultDevServerPort = 5173;
export const serverRuntimeBuildMode = 'server-runtime';

const nodeBuiltinModuleIds = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleId) => `node:${moduleId}`),
]);
const runtimeDependencyIds = Object.keys(packageJson.dependencies ?? {});

const isRuntimeExternal = (moduleId: string) =>
  nodeBuiltinModuleIds.has(moduleId) ||
  runtimeDependencyIds.some(
    (dependencyId) => moduleId === dependencyId || moduleId.startsWith(`${dependencyId}/`),
  );

const reactScanDevPlugin = (): PluginOption => ({
  name: 'brunch:react-scan-dev',
  apply: 'serve',
  transformIndexHtml() {
    return [
      {
        tag: 'script',
        attrs: {
          crossorigin: 'anonymous',
          src: 'https://unpkg.com/react-scan/dist/auto.global.js',
        },
        injectTo: 'head-prepend',
      },
    ];
  },
});

export const resolveDevServerPort = (argv: string[]) => {
  const inlinePortFlag = argv.find((arg) => arg.startsWith('--port='));

  if (inlinePortFlag) {
    const port = Number.parseInt(inlinePortFlag.slice('--port='.length), 10);

    if (Number.isInteger(port) && port > 0) {
      return port;
    }
  }

  const portFlagIndex = argv.findIndex((arg) => arg === '--port');

  if (portFlagIndex !== -1) {
    const port = Number.parseInt(argv[portFlagIndex + 1] ?? '', 10);

    if (Number.isInteger(port) && port > 0) {
      return port;
    }
  }

  return defaultDevServerPort;
};

export const getViteCacheDir = (command: 'build' | 'serve', argv: string[], mode?: string) =>
  resolve(
    __dirname,
    command === 'serve'
      ? `node_modules/.vite-${resolveDevServerPort(argv)}`
      : mode === serverRuntimeBuildMode
        ? 'node_modules/.vite-build-server'
        : 'node_modules/.vite-build',
  );

export default defineConfig(({ command, mode }) => {
  const isServerRuntimeBuild = command === 'build' && mode === serverRuntimeBuildMode;
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
      include: ['src/**/*.test.{js,ts,jsx,tsx}'],
    },
  };

  if (isServerRuntimeBuild) {
    return {
      ...sharedConfig,
      plugins: [
        {
          name: 'copy-server-prompt-assets',
          closeBundle() {
            cpSync(resolve(__dirname, 'src/server/prompts'), resolve(__dirname, 'dist/server/prompts'), {
              recursive: true,
            });
          },
        },
      ],
      build: {
        copyPublicDir: false,
        emptyOutDir: false,
        minify: false,
        outDir: resolve(__dirname, 'dist/server'),
        rollupOptions: {
          external: isRuntimeExternal,
          output: {
            chunkFileNames: 'chunks/[name]-[hash].js',
            entryFileNames: 'cli.js',
            format: 'es',
          },
        },
        ssr: resolve(__dirname, 'src/server/cli.ts'),
        target: 'node22',
      },
    };
  }

  return {
    ...sharedConfig,
    plugins: [
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
        routesDirectory: resolve(__dirname, 'src/client/routes'),
        generatedRouteTree: resolve(__dirname, 'src/client/routeTree.gen.ts'),
        routeFileIgnorePattern: '.*\\.test\\.(ts|tsx)$',
      }),
      react(),
      ...(enableReactScan ? [reactScanDevPlugin()] : []),
      tailwindcss(),
      agentTail(),
      ...(enableCodeInspector ? [codeInspectorPlugin({ bundler: 'vite' })] : []),
    ],
    server: {
      port: defaultDevServerPort,
      strictPort: true,
      proxy: {
        '/api': getBackendProxyTarget(process.env),
      },
    },
    build: {
      chunkSizeWarningLimit: 800,
    },
  };
});
