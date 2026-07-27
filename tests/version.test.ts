import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'bun:test';

// When this file lives at tests/version.test.ts, two dirnames reach the package root.
// The worktree is a full git checkout of brunch, so package.json and src/ are present.
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const cliEntrypoint = join(packageRoot, 'src', 'server', 'cli.ts');
const packageJsonPath = join(packageRoot, 'package.json');

type CommandResult = {
  code: number | null;
  stderr: string;
  stdout: string;
};

function runCli(args: string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('bun', [cliEntrypoint, ...args], {
      cwd: packageRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.once('error', reject);
    child.once('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

function getPackageVersion(): string {
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string };
  return pkg.version;
}

describe('--version flag', () => {
  it('exits with code 0 when --version is passed', async () => {
    const result = await runCli(['--version']);
    expect(result.code).toBe(0);
  }, 10_000);

  it('prints the version from package.json to stdout', async () => {
    const version = getPackageVersion();
    const result = await runCli(['--version']);
    expect(result.stdout).toContain(version);
  }, 10_000);

  it('prints nothing to stderr when --version is passed', async () => {
    const result = await runCli(['--version']);
    expect(result.stderr).toBe('');
  }, 10_000);

  it('does not launch the web server when --version is passed', async () => {
    const result = await runCli(['--version']);
    expect(result.stdout).not.toContain('Brunch running at');
    expect(result.stdout).not.toContain('localhost');
  }, 10_000);

  it('output consists only of the version string (no extra noise)', async () => {
    const version = getPackageVersion();
    const result = await runCli(['--version']);
    expect(result.stdout.trim()).toBe(version);
  }, 10_000);
});
