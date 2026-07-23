import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runCommand } from '../../../app/command-runner.js';
import {
  createBrunchSolutionIsolationPolicy,
  createClaudeSolutionIsolationPolicy,
  materializePinnedSourceTree,
  verifyPreparedHistoricalReplay,
} from '../solution-isolation.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => await rm(root, { recursive: true, force: true })));
});

describe('learning-first historical snapshots', () => {
  it('materializes a pinned tree into a fresh remote-free repository', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-comparison-source-'));
    roots.push(root);
    const source = join(root, 'source');
    const target = join(root, 'target');
    await run('git', ['init', '--initial-branch=main', source], root);
    await writeFile(join(source, 'README.md'), 'pinned source\n');
    await run('git', ['add', '--all'], source);
    await run(
      'git',
      ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'source'],
      source,
    );
    const sourceCommit = await output('git', ['rev-parse', 'HEAD'], source);

    const materialized = await materializePinnedSourceTree({
      sourceRepositoryDir: source,
      sourceCommit,
      targetDir: target,
    });

    expect(await readFile(join(target, 'README.md'), 'utf8')).toBe('pinned source\n');
    expect(materialized.sourceCommit).toBe(sourceCommit);
    expect(await output('git', ['remote'], target)).toBe('');
    expect(await output('git', ['rev-list', '--count', 'HEAD'], target)).toBe('1');
  });

  it('checks frozen packet bytes and tracked cleanliness without claiming adversarial isolation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-comparison-prefix-'));
    roots.push(root);
    const source = join(root, 'source');
    const target = join(root, 'target');
    await run('git', ['init', '--initial-branch=main', source], root);
    await writeFile(join(source, 'README.md'), 'source\n');
    await run('git', ['add', '--all'], source);
    await run(
      'git',
      ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'source'],
      source,
    );
    const sourceCommit = await output('git', ['rev-parse', 'HEAD'], source);
    const materialized = await materializePinnedSourceTree({
      sourceRepositoryDir: source,
      sourceCommit,
      targetDir: target,
    });
    const packet = [
      ['public-contract.json', '{}\n'],
      ['spec.md', '# Mission\n'],
    ] as const;
    for (const [path, bytes] of packet) await writeFile(join(target, path), bytes);
    await run('git', ['add', '--all'], target);
    await run(
      'git',
      ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'packet'],
      target,
    );
    const baseSha = await output('git', ['rev-parse', 'HEAD'], target);
    const prefix = {
      ...materialized,
      baseSha,
      packetFiles: packet.map(([path, bytes]) => ({ path, sha256: sha256(bytes) })),
    };

    await expect(verifyPreparedHistoricalReplay({ prefix })).resolves.toBeUndefined();
    await writeFile(join(target, 'spec.md'), '# Drifted\n');
    await expect(verifyPreparedHistoricalReplay({ prefix })).rejects.toThrow(
      /tracked source changes|drifted/u,
    );
  });

  it('retains lightweight target policies for both lanes', () => {
    expect(createBrunchSolutionIsolationPolicy('/tmp/target')).toMatchObject({
      executor: 'brunch',
      foregroundWebTools: false,
      executionSubagents: ['planner', 'worker'],
    });
    expect(createClaudeSolutionIsolationPolicy('/tmp/target', ['/tmp/controller'])).toMatchObject({
      executor: 'claude_code',
      strictMcp: true,
      webTools: false,
      nativeSandbox: { deniedReadRoots: ['/tmp/controller'] },
    });
  });
});

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

async function run(command: string, args: readonly string[], cwd: string): Promise<void> {
  const result = await runCommand(command, args, { cwd });
  if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout);
}

async function output(command: string, args: readonly string[], cwd: string): Promise<string> {
  const result = await runCommand(command, args, { cwd });
  if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}
