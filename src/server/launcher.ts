import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import express, { type Express } from 'express';

import { createApp } from './app.js';
import { resolveBrunchProject } from './project.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, '..', '..', 'dist');

export function mountStaticClient(app: Express, distDir: string = DIST_DIR): void {
  if (!existsSync(distDir)) {
    return;
  }

  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }

    res.sendFile(join(distDir, 'index.html'));
  });
}

export async function launch(cwd: string): Promise<void> {
  const project = resolveBrunchProject(cwd);
  console.log(`.brunch/ directory: ${project.root}`);

  const { app } = createApp({ dbPath: project.dbPath, projectCwd: cwd });

  // Serve built Vite assets as static files (production mode)
  mountStaticClient(app);

  const port = Number(process.env.PORT) || 3000;

  await new Promise<void>((resolve) => {
    app.listen(port, () => {
      console.log(`Brunch running at http://localhost:${port}`);
      resolve();
    });
  });

  if (process.env.BRUNCH_NO_OPEN === '1') {
    return;
  }

  // Open browser
  try {
    const { default: open } = await import('open');
    await open(`http://localhost:${port}`);
  } catch {
    console.log(`Open http://localhost:${port} in your browser`);
  }
}
