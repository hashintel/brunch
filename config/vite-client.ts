import { resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { codeInspectorPlugin } from 'code-inspector-plugin';
import type { UserConfig } from 'vite';
import { agentTail } from 'vite-plugin-agent-tail';

import { getBackendProxyTarget } from '../src/server/runtime-config';
import { defaultDevServerPort } from './vite-dev-server';
import { reactScanDevPlugin } from './vite-react-scan';

const createClientPlugins = ({
  enableCodeInspector,
  enableReactScan,
  rootDir,
}: {
  enableCodeInspector: boolean;
  enableReactScan: boolean;
  rootDir: string;
}) => [
  tanstackRouter({
    target: 'react',
    autoCodeSplitting: true,
    routesDirectory: resolve(rootDir, 'src/client/routes'),
    generatedRouteTree: resolve(rootDir, 'src/client/routeTree.gen.ts'),
    routeFileIgnorePattern: '.*\\.test\\.(ts|tsx)$',
  }),
  ...(enableCodeInspector ? [codeInspectorPlugin({ bundler: 'vite' })] : []),
  react(),
  ...(enableReactScan ? [reactScanDevPlugin()] : []),
  tailwindcss(),
  agentTail(),
];

export const createClientConfig = <T extends object>({
  enableCodeInspector,
  enableReactScan,
  env,
  rootDir,
  sharedConfig,
}: {
  enableCodeInspector: boolean;
  enableReactScan: boolean;
  env: NodeJS.ProcessEnv;
  rootDir: string;
  sharedConfig: T;
}): T & UserConfig => ({
  ...sharedConfig,
  plugins: createClientPlugins({ enableCodeInspector, enableReactScan, rootDir }),
  server: {
    port: defaultDevServerPort,
    strictPort: true,
    proxy: {
      '/api': getBackendProxyTarget(env),
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
  },
});
