import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { agentTail } from 'agent-tail/vite';
import { defineConfig } from 'vitest/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: './src/client/file-routes',
      generatedRouteTree: './src/client/routeTree.gen.ts',
    }),
    react(),
    tailwindcss(),
    agentTail(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
  },
  test: {
    include: ['src/**/*.test.{js,ts,jsx,tsx}'],
  },
});
