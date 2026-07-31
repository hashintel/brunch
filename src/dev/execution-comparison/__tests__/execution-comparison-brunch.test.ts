import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createSubagentToolCatalog } from '../../../.pi/extensions/subagents/session.js';
import { registerBrunchOperationalModePolicy } from '../../../app/pi-extensions.js';
import { loadBrunchSubagents } from '../../../app/pi-subagents.js';
import { parseExecutionComparisonArgs } from '../../execution-comparison-brunch.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => await rm(root, { recursive: true, force: true })));
});

describe('execution comparison Brunch CLI arguments', () => {
  it('parses a complete workspace and positive specification id', () => {
    expect(parseExecutionComparisonArgs(['--workspace', '/tmp/petri-editor', '--spec-id', '17'])).toEqual({
      workspaceDir: '/tmp/petri-editor',
      specId: 17,
    });
  });

  it('rejects another option where the workspace value is required', () => {
    expect(() => parseExecutionComparisonArgs(['--workspace', '--spec-id', '17'])).toThrow();
  });

  it('rejects missing, non-integer, and unknown options', () => {
    expect(() => parseExecutionComparisonArgs(['--workspace', '/tmp/petri-editor'])).toThrow('Usage:');
    expect(() =>
      parseExecutionComparisonArgs(['--workspace', '/tmp/petri-editor', '--spec-id', '1.5']),
    ).toThrow('Usage:');
    expect(() => parseExecutionComparisonArgs(['--unknown', 'value'])).toThrow();
  });

  it('bounds every foreground filesystem tool to the comparison target, including symlinks', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-comparison-tools-'));
    roots.push(root);
    const targetRoot = join(root, 'target');
    const outsideRoot = join(root, 'controller');
    await mkdir(targetRoot);
    await mkdir(outsideRoot);
    await writeFile(join(targetRoot, 'inside.txt'), 'inside\n');
    await writeFile(join(outsideRoot, 'excluded.txt'), 'outside comparison target\n');
    await symlink(join(outsideRoot, 'excluded.txt'), join(targetRoot, 'escaped-link.txt'));
    await symlink(outsideRoot, join(targetRoot, 'escaped-directory'));

    const tools: Array<{
      readonly name: string;
      readonly execute: (
        toolCallId: string,
        params: Record<string, unknown>,
        signal: AbortSignal | undefined,
        onUpdate: undefined,
        ctx: { cwd: string },
      ) => Promise<unknown>;
    }> = [];
    registerBrunchOperationalModePolicy(
      {
        registerTool: (tool: unknown) => tools.push(tool as (typeof tools)[number]),
        getAllTools: () => tools,
        setActiveTools: () => {},
        on: () => {},
      } as never,
      { filesystemRoot: targetRoot },
    );

    const parameters = new Map<string, Record<string, unknown>>([
      ['read', { path: join(targetRoot, 'inside.txt') }],
      ['grep', { pattern: 'inside', path: targetRoot }],
      ['find', { pattern: '*.txt', path: targetRoot }],
      ['ls', { path: targetRoot }],
    ]);
    expect(tools.map(({ name }) => name)).toEqual(['read', 'grep', 'find', 'ls']);
    for (const tool of tools) {
      await expect(
        tool.execute('allowed', parameters.get(tool.name)!, undefined, undefined, {
          cwd: targetRoot,
        }),
      ).resolves.toBeDefined();
      await expect(
        tool.execute(
          'parent-escape',
          { ...parameters.get(tool.name), path: outsideRoot },
          undefined,
          undefined,
          { cwd: targetRoot },
        ),
      ).rejects.toThrow('escapes target root');
    }
    await expect(
      tools[0]!.execute(
        'symlink-escape',
        { path: join(targetRoot, 'escaped-link.txt') },
        undefined,
        undefined,
        { cwd: targetRoot },
      ),
    ).rejects.toThrow('escapes target root through symlink');

    const childRead = createSubagentToolCatalog(targetRoot).get('read')!;
    await expect(
      childRead.execute('child-allowed', { path: 'inside.txt' }, undefined, undefined, {
        cwd: targetRoot,
      } as never),
    ).resolves.toBeDefined();
    await expect(
      childRead.execute('child-parent-escape', { path: outsideRoot }, undefined, undefined, {
        cwd: targetRoot,
      } as never),
    ).rejects.toThrow();
    await expect(
      childRead.execute('child-symlink-escape', { path: 'escaped-link.txt' }, undefined, undefined, {
        cwd: targetRoot,
      } as never),
    ).rejects.toThrow();
    const childWrite = createSubagentToolCatalog(targetRoot).get('write_worktree_file')!;
    await expect(
      childWrite.execute(
        'child-write-symlink-escape',
        { path: 'escaped-directory/leak.txt', content: 'must stay sealed\n' },
        undefined,
        undefined,
        { cwd: targetRoot } as never,
      ),
    ).rejects.toThrow('escapes the worktree');
  });

  it('loads only the sealed planner and worker for comparison execution', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-comparison-subagents-'));
    roots.push(root);
    const subagents = await loadBrunchSubagents({
      cwd: root,
      agentDir: join(root, 'agent'),
      modelRuntime: {} as never,
      delegatableAgents: [],
      includedAgents: ['planner', 'worker'],
    });

    expect([...subagents.definitions.keys()]).toEqual(['planner', 'worker']);
    expect(subagents.definitions.get('planner')?.tools).toEqual(['read']);
    expect(subagents.definitions.get('worker')?.tools).toEqual(['read', 'write_worktree_file']);
    expect(subagents.definitions.has('researcher')).toBe(false);
  });
});
