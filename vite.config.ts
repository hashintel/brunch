import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { agentTail } from 'agent-tail/vite';
import { codeInspectorPlugin } from 'code-inspector-plugin';
import { defineConfig } from 'vitest/config';

import { getBackendProxyTarget } from './src/server/runtime-config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as {
  version?: string;
};

export const defaultDevServerPort = 5173;

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

export const getViteCacheDir = (command: 'build' | 'serve', argv: string[]) =>
  resolve(
    __dirname,
    command === 'serve' ? `node_modules/.vite-${resolveDevServerPort(argv)}` : 'node_modules/.vite-build',
  );

export default defineConfig(({ command }) => {
  const enableCodeInspector = command === 'serve' && !process.env.VITEST;

  return {
    cacheDir: getViteCacheDir(command, process.argv),
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version ?? '0.0.0'),
    },
    plugins: [
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
        routesDirectory: resolve(__dirname, 'src/client/routes'),
        generatedRouteTree: resolve(__dirname, 'src/client/routeTree.gen.ts'),
        routeFileIgnorePattern: '.*\\.test\\.(ts|tsx)$',
      }),
      react(),
      tailwindcss(),
      agentTail(),
      ...(enableCodeInspector ? [codeInspectorPlugin({ bundler: 'vite' })] : []),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
      dedupe: ['react', 'react-dom'],
    },
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
    test: {
      include: ['src/**/*.test.{js,ts,jsx,tsx}'],
    },
  };
});
