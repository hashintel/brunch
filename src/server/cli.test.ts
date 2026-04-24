import { spawn } from 'node:child_process';
import { copyFileSync, mkdtempSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const sourceBinEntrypoint = join(packageRoot, 'bin', 'brunch.js');
const sourceDrizzleDirectory = join(packageRoot, 'drizzle');
const sourceNodeModules = join(packageRoot, 'node_modules');
const sourcePackageManifest = join(packageRoot, 'package.json');
const viteConfigFile = join(packageRoot, 'vite.config.ts');
const tempDirs: string[] = [];
let publishedPackageRoot = '';

function makeTempDir(prefix: string = 'brunch-cli-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function buildPublishedPackage(targetRoot: string): Promise<void> {
  mkdirSync(join(targetRoot, 'bin'), { recursive: true });
  copyFileSync(sourceBinEntrypoint, join(targetRoot, 'bin', 'brunch.js'));
  copyFileSync(sourcePackageManifest, join(targetRoot, 'package.json'));
  symlinkSync(sourceDrizzleDirectory, join(targetRoot, 'drizzle'), 'dir');
  symlinkSync(sourceNodeModules, join(targetRoot, 'node_modules'), 'dir');

  await build({
    build: {
      outDir: join(targetRoot, 'dist'),
    },
    configFile: viteConfigFile,
    logLevel: 'silent',
  });

  await build({
    build: {
      emptyOutDir: false,
      outDir: join(targetRoot, 'dist', 'server'),
    },
    configFile: viteConfigFile,
    logLevel: 'silent',
    mode: 'server-runtime',
  });
}

function getPublishedBinEntrypoint(): string {
  return join(publishedPackageRoot, 'bin', 'brunch.js');
}

function runCli(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [getPublishedBinEntrypoint(), ...args], {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.once('error', reject);
    child.once('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

describe('published CLI entrypoint', () => {
  beforeAll(async () => {
    publishedPackageRoot = makeTempDir('brunch-published-package-');
    await buildPublishedPackage(publishedPackageRoot);
  }, 60_000);

  afterAll(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('executes through the package bin wrapper', async () => {
    const result = await runCli(['--help'], packageRoot);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('Usage: brunch');
    expect(result.stdout).toContain('Launch the Brunch web UI in the current project directory.');
  });

  it('executes through the package bin wrapper when launched outside the package root', async () => {
    const result = await runCli(['--help'], makeTempDir());

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('Usage: brunch');
  });

  it('launches the compiled package runtime and serves the built client artifact for a workspace cwd', async () => {
    const workspaceCwd = makeTempDir('brunch-workspace-');

    const child = spawn(process.execPath, [getPublishedBinEntrypoint()], {
      cwd: workspaceCwd,
      env: {
        ...process.env,
        BRUNCH_NO_OPEN: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    const url = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(`Timed out waiting for compiled launcher output. stdout: ${stdout}\nstderr: ${stderr}`),
        );
      }, 20_000);

      child.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      child.once('exit', (code) => {
        clearTimeout(timeout);
        reject(
          new Error(`Compiled launcher exited early with code ${code}. stdout: ${stdout}\nstderr: ${stderr}`),
        );
      });

      child.stdout?.on('data', () => {
        const match = stdout.match(/Brunch running at (http:\/\/localhost:\d+)/);
        if (!match) {
          return;
        }

        clearTimeout(timeout);
        resolve(match[1]);
      });
    });

    try {
      const indexResponse = await fetch(url);
      expect(indexResponse.ok).toBe(true);
      expect(await indexResponse.text()).toContain('<div id="root"></div>');

      const apiResponse = await fetch(`${url}/api/specifications`);
      expect(apiResponse.ok).toBe(true);
      expect(await apiResponse.json()).toEqual([]);

      expect(stdout).toMatch(/\.brunch\/ directory: .*\/\.brunch/);
      expect(stderr).toBe('');
    } finally {
      child.kill('SIGTERM');
      await new Promise((resolve) => {
        child.once('exit', resolve);
      });
    }
  }, 30_000);
});
