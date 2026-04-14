import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { agentTail } from 'agent-tail/vite';
import { defineConfig } from 'vitest/config';

import { getBackendProxyTarget } from './src/server/runtime-config';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const defaultDevServerPort = 5173;

const isLadleProcess = () => typeof process.env.VITE_LADLE_APP_ID === 'string';

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
    isLadleProcess()
      ? command === 'serve'
        ? 'node_modules/.vite-ladle'
        : 'node_modules/.vite-ladle-build'
      : command === 'serve'
        ? `node_modules/.vite-${resolveDevServerPort(argv)}`
        : 'node_modules/.vite-build',
  );

export default defineConfig(({ command }) => ({
  cacheDir: getViteCacheDir(command, process.argv),
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
}));
