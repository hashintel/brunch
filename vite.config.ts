import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src/client'),
		},
	},
	server: {
		proxy: {
			'/api': 'http://localhost:3000',
		},
	},
	test: {
		include: ['src/**/*.test.{js,ts,jsx,tsx}'],
	},
});
