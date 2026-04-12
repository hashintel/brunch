import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';

import { createApp } from './app.js';
import { resolveBrunchProject } from './project.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, '..', '..', 'dist');

export async function launch(cwd: string): Promise<void> {
  const project = resolveBrunchProject(cwd);
  console.log(`.brunch/ directory: ${project.root}`);

  const { app } = createApp(project.dbPath);

  // Serve built Vite assets as static files (production mode)
  if (existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));

    // SPA fallback: serve index.html for all non-API routes
    app.get('*', (_req, res) => {
      res.sendFile(join(DIST_DIR, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;

  await new Promise<void>((resolve) => {
    app.listen(port, () => {
      console.log(`Brunch running at http://localhost:${port}`);
      resolve();
    });
  });

  // Open browser
  try {
    const { default: open } = await import('open');
    await open(`http://localhost:${port}`);
  } catch {
    console.log(`Open http://localhost:${port} in your browser`);
  }
}
