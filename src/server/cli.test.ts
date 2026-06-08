import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const sourceNodeModules = join(packageRoot, 'node_modules');
const viteConfigFile = join(packageRoot, 'vite.config.ts');
const tempDirs: string[] = [];

type CommandResult = {
  code: number | null;
  stderr: string;
  stdout: string;
};

type PackFileEntry = {
  path: string;
};

type PackResult = {
  files: PackFileEntry[];
  filename: string;
};

let installedPackageRoot = '';
let packFilePaths: string[] = [];

type PackedPackageManifest = {
  dependencies?: Record<string, string>;
};

function makeTempDir(prefix: string = 'brunch-cli-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function buildPackageAssets(): Promise<void> {
  await build({
    configFile: viteConfigFile,
    logLevel: 'silent',
  });

  await build({
    configFile: viteConfigFile,
    logLevel: 'silent',
    mode: 'server-runtime',
  });
}

function getInstalledBinEntrypoint(): string {
  return join(installedPackageRoot, 'bin', 'brunch.js');
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
  input?: string,
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    if (input !== undefined) {
      child.stdin?.end(input);
    }
    child.once('error', reject);
    child.once('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function packBuiltPackage(): Promise<{ filePaths: string[]; installedRoot: string }> {
  const packDir = makeTempDir('brunch-pack-');
  const packResult = await runCommand('npm', ['pack', '--json', '--pack-destination', packDir], packageRoot);

  if (packResult.code !== 0) {
    throw new Error(`npm pack failed. stdout: ${packResult.stdout}\nstderr: ${packResult.stderr}`);
  }

  const [packedArtifact] = JSON.parse(packResult.stdout) as PackResult[];
  const installedRoot = makeTempDir('brunch-installed-package-');

  symlinkSync(sourceNodeModules, join(installedRoot, 'node_modules'), 'dir');

  const extractResult = await runCommand(
    'tar',
    ['-xzf', join(packDir, packedArtifact.filename), '-C', installedRoot],
    packageRoot,
  );

  if (extractResult.code !== 0) {
    throw new Error(
      `tar extraction failed. stdout: ${extractResult.stdout}\nstderr: ${extractResult.stderr}`,
    );
  }

  return {
    filePaths: packedArtifact.files.map((file) => file.path),
    installedRoot: join(installedRoot, 'package'),
  };
}

function runCli(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
  input?: string,
): Promise<CommandResult> {
  return runCommand(process.execPath, [getInstalledBinEntrypoint(), ...args], cwd, env, input);
}

describe('published CLI entrypoint', () => {
  beforeAll(async () => {
    await buildPackageAssets();

    const packedPackage = await packBuiltPackage();
    installedPackageRoot = packedPackage.installedRoot;
    packFilePaths = packedPackage.filePaths;
  }, 60_000);

  afterAll(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('packs only the runtime assets needed for the published package', () => {
    expect(packFilePaths).toEqual(
      expect.arrayContaining([
        'LICENSE',
        'README.md',
        'bin/brunch.js',
        'dist/favicon.ico',
        'dist/index.html',
        'dist/server/cli.js',
        'drizzle/meta/_journal.json',
        'package.json',
      ]),
    );
    expect(packFilePaths.some((path) => path.startsWith('dist/assets/'))).toBe(true);

    for (const excludedPath of ['.agents/', 'docs/', 'memory/', 'src/', 'tmp/', 'vite.config.ts']) {
      expect(packFilePaths.some((path) => path.startsWith(excludedPath) || path === excludedPath)).toBe(
        false,
      );
    }
  });

  it('omits Ladle from the published runtime dependency set', () => {
    const packageManifest = JSON.parse(
      readFileSync(join(installedPackageRoot, 'package.json'), 'utf8'),
    ) as PackedPackageManifest;

    expect(packageManifest.dependencies?.['@ladle/react']).toBeUndefined();
  });

  it('executes through the package bin wrapper', async () => {
    const result = await runCli(['--help'], packageRoot);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('Usage: brunch');
    expect(result.stdout).toContain('Launch the Brunch web UI in the current project directory.');
    expect(result.stdout).toContain('plan <specId>');
    // Help must list every cook flag the parser accepts — guards against the
    // drift where Petrinaut flags existed but went undocumented.
    for (const flag of [
      '--spec=',
      '--policy=',
      '--max-retries=',
      '--petrinaut-fold=',
      '--petrinaut-lanes=',
      '--petrinaut-stream',
      '--petrinaut-url=',
      '--no-petrinaut-open',
      '--verbose, -v',
    ]) {
      expect(result.stdout).toContain(flag);
    }
    expect(result.stdout).toContain('PETRINAUT_URL');
  });

  it('rejects `brunch plan` invocations with no spec id', async () => {
    const result = await runCli(['plan'], makeTempDir('brunch-plan-usage-'));

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('Failed to run brunch plan');
    expect(result.stderr.toLowerCase()).toContain('spec id');
  });

  it('rejects `brunch plan <non-numeric>` with a friendly usage error', async () => {
    const result = await runCli(['plan', 'abc'], makeTempDir('brunch-plan-bad-id-'));

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('Failed to run brunch plan');
    expect(result.stderr.toLowerCase()).toContain('spec id');
  });

  it('reports `specification <id> not found` when the project DB is empty', async () => {
    const result = await runCli(['plan', '999'], makeTempDir('brunch-plan-missing-'));

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('Failed to run brunch plan');
    expect(result.stderr).toContain('specification 999 not found');
  });

  it('executes through the package bin wrapper when launched outside the package root', async () => {
    const result = await runCli(['--help'], makeTempDir());

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('Usage: brunch');
  });

  it('runs the packaged agent JSONL session without launching the web UI', async () => {
    const workspaceCwd = makeTempDir('brunch-agent-workspace-');
    const input = `${JSON.stringify({
      id: 'create-1',
      capability: 'spec.create',
      input: { name: 'Packaged agent spec' },
    })}\n${JSON.stringify({ id: 'read-1', capability: 'spec.getStatus', input: { specId: 1 } })}\n`;

    const result = await runCli(['agent'], workspaceCwd, process.env, input);
    const responses = result.stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as unknown);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(responses).toEqual([
      expect.objectContaining({ id: 'create-1', ok: true, output: expect.objectContaining({ specId: 1 }) }),
      expect.objectContaining({
        id: 'read-1',
        ok: true,
        output: expect.objectContaining({
          specification: expect.objectContaining({ id: 1, name: 'Packaged agent spec' }),
        }),
      }),
    ]);
  });

  it('dry-runs the release flow against the packaged npm artifact seam', async () => {
    const result = await runCommand(
      'npm',
      [
        'run',
        'release',
        '--',
        '--dry-run',
        '--ci',
        'patch',
        '--git.requireCleanWorkingDir=false',
        '--git.requireUpstream=false',
        '--git.push=false',
        '--npm.skipChecks=true',
      ],
      packageRoot,
    );

    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.code).toBe(0);
    expect(output).toContain('npm run build');
    expect(output).toContain('npm pack --dry-run --json');
    expect(output).toContain('npm publish');
    expect(output).toContain('@hashintel/brunch');
  }, 30_000);

  it('launches the compiled package runtime and serves the built client artifact for a workspace cwd', async () => {
    const workspaceCwd = makeTempDir('brunch-workspace-');

    const child = spawn(process.execPath, [getInstalledBinEntrypoint()], {
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

      const faviconResponse = await fetch(`${url}/favicon.ico`);
      expect(faviconResponse.ok).toBe(true);
      expect(faviconResponse.headers.get('content-type')).toContain('icon');

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
