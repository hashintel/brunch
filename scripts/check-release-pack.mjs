#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
// Release/CI smoke only: this packs and installs the published artifact shape, so it is
// intentionally slower than `npm run verify` and is not part of the local gate.
import { mkdtemp, mkdir, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

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
    for (const skillPath of await liveSkillPaths()) {
      assertIncludes(tarEntries, skillPath);
    }

    run(npmCommand, ['install', '--global', '--prefix', prefixDir, tarballPath]);

    const brunchBin = path.join(prefixDir, 'bin', process.platform === 'win32' ? 'brunch.cmd' : 'brunch');
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

    process.stdout.write('check:release-pack OK — packed artifact installs and boots from a foreign cwd\n');
  } finally {
    if (process.env.BRUNCH_KEEP_RELEASE_PACK_TMP === '1') {
      process.stderr.write(`Keeping release-pack temp dir: ${workDir}\n`);
    } else {
      await rm(workDir, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
