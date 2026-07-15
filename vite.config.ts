import { createRequire } from 'node:module';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const { version } = createRequire(import.meta.url)('./package.json') as { version: string };

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  define: {
    __BRUNCH_VERSION__: JSON.stringify(version),
  },
  build: {
    outDir: 'dist-web',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/brunch-web.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/dist-web/**', '**/_suspended/**', '**/.brunch/**'],
    // Real-git witnesses (host promotion and slice integration) can take
    // 30s on machines with slow process spawn under full-suite load. The test
    // script bounds worker count separately.
    testTimeout: 60000,
  },
}));
