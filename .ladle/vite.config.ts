import { resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  cacheDir: resolve(process.cwd(), 'node_modules/.vite-ladle'),
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(process.cwd(), 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },
});
