// The probe boots a *real* app process in a tmp worktree and exercises it over
// the wire — no mocks — so these tests pin the actual boot/ready/probe/teardown
// behavior the orphan check depends on. Apps are zero-dep `node:http` scripts.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildProbeSpec, runProbe } from './app-probe.js';
import type { ProbeSpec } from './types.js';

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function sandbox(serverSource: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'app-probe-'));
  dirs.push(dir);
  writeFileSync(join(dir, 'server.js'), serverSource);
  return dir;
}

/** An app that answers `routes` (path → status); everything else is 404. */
const appServing = (routes: Record<string, number>): string =>
  `const http = require('node:http');\n` +
  `const routes = ${JSON.stringify(routes)};\n` +
  `http.createServer((req, res) => {\n` +
  `  const status = routes[req.url] ?? 404;\n` +
  `  res.writeHead(status); res.end(String(status));\n` +
  `}).listen(Number(process.env.PORT), '127.0.0.1');\n`;

// Dogfoods the harness-owned spec builder: the test supplies only argv + paths,
// `buildProbeSpec` allocates the port and assembles the URLs the app boots on.
async function specFor(routes: Record<string, number>): Promise<{ spec: ProbeSpec; dir: string }> {
  const spec = await buildProbeSpec({
    boot: ['node', 'server.js'],
    readyPath: '/health',
    featurePath: '/feature',
  });
  return { dir: sandbox(appServing(routes)), spec };
}

describe('runProbe classifies real app reachability', () => {
  it('an app whose feature endpoint answers 2xx → reachable', async () => {
    const { spec, dir } = await specFor({ '/health': 200, '/feature': 200 });
    const result = await runProbe(spec, dir);
    expect(result.kind).toBe('reachable');
    expect(result.reachable).toBe(true);
    expect(result.status).toBe(200);
  });

  it('an app that boots but 404s the feature endpoint → not-reachable (the orphan)', async () => {
    // Feature module present-but-unwired replays as: server up, route absent.
    const { spec, dir } = await specFor({ '/health': 200 });
    const result = await runProbe(spec, dir);
    expect(result.kind).toBe('not-reachable');
    expect(result.reachable).toBe(false);
    expect(result.status).toBe(404);
  });

  it('a boot command that exits immediately → infra (distinct from not-reachable)', async () => {
    const dir = sandbox('process.exit(1);\n');
    const result = await runProbe(
      { boot: ['node', 'server.js'], readyUrl: 'http://127.0.0.1:1/x', featureUrl: 'http://127.0.0.1:1/x' },
      dir,
    );
    expect(result.kind).toBe('infra');
    expect(result.reachable).toBe(false);
  });

  it('a missing boot binary → infra, not a crash', async () => {
    const dir = sandbox(appServing({ '/health': 200 }));
    const started = Date.now();
    const result = await runProbe(
      {
        boot: ['definitely-not-a-real-binary-xyz'],
        readyUrl: 'http://127.0.0.1:1/x',
        featureUrl: 'http://127.0.0.1:1/x',
      },
      dir,
    );
    expect(result.kind).toBe('infra');
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});

describe('runProbe bounds its HTTP calls so a hung app cannot hang the probe', () => {
  // A server that accepts connections (and the HTTP request) but never sends a
  // response — the case the wall-clock deadline alone can't catch, because a
  // bare `await fetch` would block forever between deadline checks.
  const neverResponds = (readyRoutes: Record<string, number> = {}): string =>
    `const http = require('node:http');\n` +
    `const ready = ${JSON.stringify(readyRoutes)};\n` +
    `http.createServer((req, res) => {\n` +
    `  if (ready[req.url] !== undefined) { res.writeHead(ready[req.url]); res.end('ok'); return; }\n` +
    `  /* otherwise: never respond */\n` +
    `}).listen(Number(process.env.PORT), '127.0.0.1');\n`;

  it('a ready path that accepts connections but never responds → infra within the deadline', async () => {
    const spec = await buildProbeSpec({
      boot: ['node', 'server.js'],
      readyPath: '/health',
      featurePath: '/feature',
    });
    const dir = sandbox(neverResponds());
    const started = Date.now();
    const result = await runProbe(spec, dir, { readyTimeoutMs: 600, readyAttemptMs: 2_000 });
    expect(result.kind).toBe('infra');
    expect(Date.now() - started).toBeLessThan(1_200);
  });

  it('a booted app whose feature endpoint never responds → infra, not a hang', async () => {
    const spec = await buildProbeSpec({
      boot: ['node', 'server.js'],
      readyPath: '/health',
      featurePath: '/feature',
    });
    const dir = sandbox(neverResponds({ '/health': 200 }));
    const result = await runProbe(spec, dir, { requestTimeoutMs: 300 });
    expect(result.kind).toBe('infra');
    expect(result.output).toMatch(/feature probe request failed/);
  });
});

describe('runProbe bounds its HTTP calls so a hung app cannot hang the probe', () => {
  // A server that accepts connections (and the HTTP request) but never sends a
  // response — the case the wall-clock deadline alone can't catch, because a
  // bare `await fetch` would block forever between deadline checks.
  const neverResponds = (readyRoutes: Record<string, number> = {}): string =>
    `const http = require('node:http');\n` +
    `const ready = ${JSON.stringify(readyRoutes)};\n` +
    `http.createServer((req, res) => {\n` +
    `  if (ready[req.url] !== undefined) { res.writeHead(ready[req.url]); res.end('ok'); return; }\n` +
    `  /* otherwise: never respond */\n` +
    `}).listen(Number(process.env.PORT), '127.0.0.1');\n`;

  it('a ready path that accepts connections but never responds → infra within the deadline', async () => {
    const spec = await buildProbeSpec({
      boot: ['node', 'server.js'],
      readyPath: '/health',
      featurePath: '/feature',
    });
    const dir = sandbox(neverResponds());
    const result = await runProbe(spec, dir, { readyTimeoutMs: 600, readyAttemptMs: 150 });
    expect(result.kind).toBe('infra');
  });

  it('a booted app whose feature endpoint never responds → infra, not a hang', async () => {
    const spec = await buildProbeSpec({
      boot: ['node', 'server.js'],
      readyPath: '/health',
      featurePath: '/feature',
    });
    const dir = sandbox(neverResponds({ '/health': 200 }));
    const result = await runProbe(spec, dir, { requestTimeoutMs: 300 });
    expect(result.kind).toBe('infra');
    expect(result.output).toMatch(/feature probe request failed/);
  });
});

describe('runProbe tears the boot process down', () => {
  it('the booted app is no longer listening after the probe returns', async () => {
    const { spec, dir } = await specFor({ '/health': 200, '/feature': 200 });
    await runProbe(spec, dir);
    // The port the app bound should be free again — nothing left listening.
    await expect(fetch(spec.featureUrl)).rejects.toThrow();
  });
});

describe('buildProbeSpec resolves a target into a runnable spec', () => {
  it('allocates a port and assembles ready/feature URLs from the paths', async () => {
    const spec = await buildProbeSpec({
      boot: ['node', 'server.js'],
      readyPath: '/health',
      featurePath: '/feature',
    });
    const port = Number(spec.env?.PORT);
    expect(port).toBeGreaterThan(0);
    expect(spec.readyUrl).toBe(`http://127.0.0.1:${port}/health`);
    expect(spec.featureUrl).toBe(`http://127.0.0.1:${port}/feature`);
    expect(spec.boot).toEqual(['node', 'server.js']);
  });

  it('layers caller env under the allocated PORT so PORT always wins', async () => {
    const spec = await buildProbeSpec({
      boot: ['node', 'server.js'],
      readyPath: '/',
      featurePath: '/',
      env: { NODE_ENV: 'test', PORT: '1' },
    });
    expect(spec.env?.NODE_ENV).toBe('test');
    expect(Number(spec.env?.PORT)).toBeGreaterThan(1);
  });

  it('hands out distinct ports across concurrent allocations', async () => {
    const specs = await Promise.all(
      Array.from({ length: 8 }, () => buildProbeSpec({ boot: ['x'], readyPath: '/', featurePath: '/' })),
    );
    const ports = specs.map((s) => Number(s.env?.PORT));
    expect(new Set(ports).size).toBe(ports.length);
  });
});
