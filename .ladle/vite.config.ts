import { resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const rootDir = process.cwd();
const rootNodeModules = resolve(rootDir, 'node_modules');

export default defineConfig({
  cacheDir: resolve(rootDir, 'node_modules/.vite-ladle'),
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(rootDir, 'src'),
      react: resolve(rootNodeModules, 'react'),
      'react-dom': resolve(rootNodeModules, 'react-dom'),
      'react-dom/client': resolve(rootNodeModules, 'react-dom/client'),
      'react/jsx-dev-runtime': resolve(rootNodeModules, 'react/jsx-dev-runtime'),
      'react/jsx-runtime': resolve(rootNodeModules, 'react/jsx-runtime'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-dev-runtime', 'react/jsx-runtime'],
  },
});
