import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import express, { type Express } from 'express';

import { createApp } from './app.js';
import { resolveBrunchProject } from './project.js';
import { closeServer, listenOnLocalhost, resolveBackendPort } from './runtime-config.js';
import { acquireRuntimeGuard } from './runtime-guard.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, '..', '..', 'dist');

export interface LauncherRuntime {
  readonly projectRoot: string;
  readonly port: number;
  readonly url: string;
  close(): Promise<void>;
}

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

export async function startLauncherRuntime(
  cwd: string,
  options?: { readonly distDir?: string; readonly port?: number },
): Promise<LauncherRuntime> {
  const project = resolveBrunchProject(cwd);
  const guard = acquireRuntimeGuard(project.root, cwd);

  try {
    const { app } = createApp({ dbPath: project.dbPath, projectCwd: cwd });
    mountStaticClient(app, options?.distDir ?? DIST_DIR);

    const runtime = await listenOnLocalhost(app, options?.port ?? resolveBackendPort(process.env, 0));
    guard.updatePort(runtime.port);

    const releaseOnExit = () => {
      guard.release();
    };

    process.once('exit', releaseOnExit);
    runtime.server.once('close', () => {
      process.removeListener('exit', releaseOnExit);
      guard.release();
    });

    return {
      projectRoot: project.root,
      port: runtime.port,
      url: runtime.url,
      close: async () => {
        await closeServer(runtime.server);
      },
    };
  } catch (error) {
    guard.release();
    throw error;
  }
}

export async function launch(cwd: string): Promise<void> {
  const runtime = await startLauncherRuntime(cwd);
  console.log(`.brunch/ directory: ${runtime.projectRoot}`);
  console.log(`Brunch running at ${runtime.url}`);

  if (process.env.BRUNCH_NO_OPEN === '1') {
    return;
  }

  // Open browser
  try {
    const { default: open } = await import('open');
    await open(runtime.url);
  } catch {
    console.log(`Open ${runtime.url} in your browser`);
  }
}
