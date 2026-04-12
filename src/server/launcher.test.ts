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

  const makeTempDir = () => {
    const dir = mkdtempSync(join(tmpdir(), 'brunch-launcher-'));
    tempDirs.push(dir);
    return dir;
  };

  afterEach(() => {
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

  it('serves static files while preserving API 404s', async () => {
    const cwd = makeTempDir();
    const distDir = join(makeTempDir(), 'dist');
    mkdirSync(distDir, { recursive: true });
    writeFileSync(join(distDir, 'index.html'), '<!doctype html><html><body>Brunch</body></html>');

    const project = resolveBrunchProject(cwd);
    const { app } = createApp(project.dbPath);
    mountStaticClient(app, distDir);

    await request(app)
      .get('/project/123')
      .expect(200)
      .expect(/Brunch/);
    await request(app).get('/api/missing').expect(404);
  });

  it('resolves drizzle migrations when cwd differs from package root', () => {
    // The key risk: migrations path is relative to import.meta.url, not cwd
    const cwd = makeTempDir();
    const project = resolveBrunchProject(cwd);

    // This would throw if migrations can't be found
    expect(() => createApp(project.dbPath)).not.toThrow();
  });
});
