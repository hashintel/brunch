import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from './app.js';
import { mountStaticClient, type LauncherRuntime, startLauncherRuntime } from './launcher.js';
import { resolveBrunchProject } from './project.js';

describe('launcher integration', () => {
  const tempDirs: string[] = [];
  const runtimes: LauncherRuntime[] = [];
  const originalCwd = process.cwd();

  const makeTempDir = () => {
    const dir = mkdtempSync(join(tmpdir(), 'brunch-launcher-'));
    tempDirs.push(dir);
    return dir;
  };

  afterEach(async () => {
    process.chdir(originalCwd);

    while (runtimes.length > 0) {
      await runtimes.pop()!.close();
    }

    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it('serves API from a .brunch/ project directory', async () => {
    const cwd = makeTempDir();
    const project = resolveBrunchProject(cwd);
    const { app } = createApp(project.dbPath);

    const res = await request(app).get('/api/specifications').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('serves static assets and SPA fallback while preserving API 404s', async () => {
    const cwd = makeTempDir();
    const distDir = join(makeTempDir(), 'dist');
    mkdirSync(distDir, { recursive: true });
    writeFileSync(join(distDir, 'index.html'), '<!doctype html><html><body>Brunch</body></html>');
    writeFileSync(join(distDir, 'app.js'), 'console.log("brunch")');

    const project = resolveBrunchProject(cwd);
    const { app } = createApp(project.dbPath);
    mountStaticClient(app, distDir);

    await request(app)
      .get('/app.js')
      .expect(200)
      .expect(/console\.log\("brunch"\)/);
    await request(app)
      .get('/project/123')
      .expect(200)
      .expect(/Brunch/);
    await request(app).get('/api/missing').expect(404);
  });

  it('resolves drizzle migrations when cwd differs from the package root', async () => {
    const projectCwd = makeTempDir();
    const unrelatedCwd = makeTempDir();
    const project = resolveBrunchProject(projectCwd);

    process.chdir(unrelatedCwd);

    const { app } = createApp(project.dbPath);
    await request(app).get('/api/specifications').expect(200);
  });

  it('binds an actual available port and serves the app from the bound URL', async () => {
    const runtime = await startLauncherRuntime(makeTempDir(), { port: 0 });
    runtimes.push(runtime);

    expect(runtime.port).toBeGreaterThan(0);

    const response = await fetch(`${runtime.url}/api/specifications`);
    expect(response.ok).toBe(true);
    expect(await response.json()).toEqual([]);
  });

  it('allows different project roots concurrently but rejects duplicate launches for the same resolved root', async () => {
    const firstRoot = makeTempDir();
    const nestedChild = join(firstRoot, 'packages', 'frontend');
    mkdirSync(nestedChild, { recursive: true });

    const firstRuntime = await startLauncherRuntime(firstRoot, { port: 0 });
    const secondRuntime = await startLauncherRuntime(makeTempDir(), { port: 0 });
    runtimes.push(firstRuntime, secondRuntime);

    expect(firstRuntime.port).not.toBe(secondRuntime.port);

    await expect(startLauncherRuntime(nestedChild, { port: 0 })).rejects.toThrow(
      /already running.*same project/i,
    );
  });
});
