#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
// Release/CI smoke only: this packs and installs the published artifact shape, so it is
// intentionally slower than `npm run verify` and is not part of the local gate.
import { mkdtemp, mkdir, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = process.cwd();
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const tarCommand = process.platform === 'win32' ? 'tar.exe' : 'tar';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
    throw new Error(
      [`${command} ${args.join(' ')} failed with exit ${result.status}`, output].filter(Boolean).join('\n'),
    );
  }

  return result.stdout ?? '';
}

function assertIncludes(entries, expectedPath) {
  const packedPath = `package/${expectedPath}`;
  if (!entries.has(packedPath)) {
    throw new Error(`Packed tarball is missing ${expectedPath}`);
  }
}

async function liveSkillPaths() {
  const skillRoot = path.join(repoRoot, 'src/agents/skills');
  const names = (await readdir(skillRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(path.join(skillRoot, name, 'SKILL.md')))
    .sort();

  if (names.length !== 8) {
    throw new Error(`Expected 8 live Brunch skills, found ${names.length}: ${names.join(', ')}`);
  }

  return names.map((name) => `dist/agents/skills/${name}/SKILL.md`);
}

const RUNTIME_MARKDOWN_ASSET_DIRS = [
  ['src/agents/prompts', 'dist/agents/prompts'],
  ['src/agents/subagents', 'dist/agents/subagents'],
  ['src/agents/references', 'dist/agents/references'],
];

export async function runtimeMarkdownAssetPaths(root = repoRoot) {
  const paths = [];
  for (const [sourceDir, distDir] of RUNTIME_MARKDOWN_ASSET_DIRS) {
    const entries = await readdir(path.join(root, sourceDir), { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name === 'TOPOLOGY.md') continue;
      paths.push(path.posix.join(distDir, entry.name));
    }
  }
  return paths.sort();
}

export function installedBrunchBinPath(prefixDir, platform = process.platform) {
  return platform === 'win32' ? path.join(prefixDir, 'brunch.cmd') : path.join(prefixDir, 'bin', 'brunch');
}

async function main() {
  const workDir = await mkdtemp(path.join(tmpdir(), 'brunch-release-pack-'));
  const packDir = path.join(workDir, 'pack');
  const prefixDir = path.join(workDir, 'prefix');
  const foreignCwd = path.join(workDir, 'foreign-cwd');

  try {
    await readdir(workDir);
    await rm(packDir, { recursive: true, force: true });
    await rm(prefixDir, { recursive: true, force: true });
    await rm(foreignCwd, { recursive: true, force: true });

    await mkdir(packDir, { recursive: true });
    await mkdir(prefixDir, { recursive: true });
    await mkdir(foreignCwd, { recursive: true });
    run(npmCommand, ['pack', '--pack-destination', packDir]);

    const tarballs = (await readdir(packDir)).filter((name) => name.endsWith('.tgz'));
    if (tarballs.length !== 1) {
      throw new Error(`Expected exactly one packed tarball, found ${tarballs.length}`);
    }

    const tarballPath = path.join(packDir, tarballs[0]);
    const tarEntries = new Set(
      run(tarCommand, ['-tf', tarballPath], { capture: true }).split('\n').filter(Boolean),
    );

    assertIncludes(tarEntries, 'dist/agents/prompts/registry.js');
    for (const assetPath of await runtimeMarkdownAssetPaths()) {
      assertIncludes(tarEntries, assetPath);
    }
    for (const skillPath of await liveSkillPaths()) {
      assertIncludes(tarEntries, skillPath);
    }

    run(npmCommand, ['install', '--global', '--prefix', prefixDir, tarballPath]);

    const brunchBin = installedBrunchBinPath(prefixDir);
    if (!existsSync(brunchBin)) {
      throw new Error(`Installed package did not create expected bin at ${brunchBin}`);
    }

    const cliResult = spawnSync(brunchBin, ['--mode', 'print'], {
      cwd: foreignCwd,
      encoding: 'utf8',
      stdio: 'pipe',
      env: process.env,
    });

    if (cliResult.status !== 0) {
      throw new Error(
        [`${brunchBin} --mode print failed with exit ${cliResult.status}`, cliResult.stdout, cliResult.stderr]
          .filter(Boolean)
          .join('\n'),
      );
    }

    const output = [cliResult.stdout, cliResult.stderr].filter(Boolean).join('\n');
    if (!output.includes('Brunch workspace state')) {
      throw new Error(`Expected print-mode output to include "Brunch workspace state"; got:\n${output}`);
    }

    // DB-touching leg: --mode print from an empty cwd never opens SQLite, so a
    // broken better-sqlite3 native binding (blocked install script, ABI mismatch)
    // would slip past the boot check. One rpc-mode workspace.activate creates
    // .brunch/brunch-v1.db through the installed binding.
    const rpcRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'workspace.activate',
      params: { decision: { action: 'newSpec', title: 'Release smoke spec' } },
    };
    const rpcResult = spawnSync(brunchBin, ['--mode', 'rpc'], {
      cwd: foreignCwd,
      encoding: 'utf8',
      stdio: 'pipe',
      input: `${JSON.stringify(rpcRequest)}\n`,
      env: process.env,
    });

    if (rpcResult.status !== 0) {
      throw new Error(
        [`${brunchBin} --mode rpc failed with exit ${rpcResult.status}`, rpcResult.stdout, rpcResult.stderr]
          .filter(Boolean)
          .join('\n'),
      );
    }

    const rpcResponse = (rpcResult.stdout ?? '')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .find((message) => message.id === 1);
    if (!rpcResponse || rpcResponse.error || rpcResponse.result?.status !== 'ready') {
      throw new Error(
        `Expected workspace.activate to answer status "ready"; got:\n${rpcResult.stdout}\n${rpcResult.stderr}`,
      );
    }
    if (!existsSync(path.join(foreignCwd, '.brunch', 'brunch-v1.db'))) {
      throw new Error(
        'workspace.activate did not create .brunch/brunch-v1.db (native sqlite binding untested)',
      );
    }

    process.stdout.write(
      'check:release-pack OK — packed artifact installs, boots from a foreign cwd, and opens SQLite\n',
    );
  } finally {
    if (process.env.BRUNCH_KEEP_RELEASE_PACK_TMP === '1') {
      process.stderr.write(`Keeping release-pack temp dir: ${workDir}\n`);
    } else {
      await rm(workDir, { recursive: true, force: true });
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
