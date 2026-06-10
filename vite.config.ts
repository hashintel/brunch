import { createRequire } from 'node:module';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// `.ts` specifier: vite loads this config through its own esbuild loader, which
// resolves the real source file. (Source modules under src/ use the `.js`
// NodeNext convention instead.)
import { piSourceAlias } from './src/dev/pi-source-alias.ts';

const { version } = createRequire(import.meta.url)('./package.json') as { version: string };

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  define: {
    __BRUNCH_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: piSourceAlias(),
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
}));
