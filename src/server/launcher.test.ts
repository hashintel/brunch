import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from './app.js';
import { mountStaticClient } from './launcher.js';
import { resolveBrunchProject } from './project.js';

describe('launcher integration', () => {
  const tempDirs: string[] = [];
  const originalCwd = process.cwd();

  const makeTempDir = () => {
    const dir = mkdtempSync(join(tmpdir(), 'brunch-launcher-'));
    tempDirs.push(dir);
    return dir;
  };

  afterEach(() => {
    process.chdir(originalCwd);
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it('serves API from a .brunch/ project directory', async () => {
    const cwd = makeTempDir();
    const project = resolveBrunchProject(cwd);
    const { app } = createApp(project.dbPath);

    const res = await request(app).get('/api/projects').expect(200);
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
    await request(app).get('/api/projects').expect(200);
  });
});
