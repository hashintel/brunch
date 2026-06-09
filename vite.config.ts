import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// `.ts` specifier: vite loads this config through its own esbuild loader, which
// resolves the real source file. (Source modules under src/ use the `.js`
// NodeNext convention instead.)
import { piSourceAlias } from './src/dev/pi-source-alias.ts';

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
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
