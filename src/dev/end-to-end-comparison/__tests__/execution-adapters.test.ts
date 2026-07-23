import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { runCommand, type CommandRunner } from '../../../app/command-runner.js';
import { prepareBrunchExecutionCell } from '../brunch-adapter.js';
import {
  createClaudeExecutionLaunch,
  finalizeClaudeExecutionWorkspace,
  prepareClaudeExecutionWorkspace,
  runClaudeExecutionWorkspace,
} from '../claude-adapter.js';
import { createClaudeSolutionIsolationPolicy } from '../solution-isolation.js';

const roots: string[] = [];
const contractTemplatePath = fileURLToPath(
  new URL(
    '../../../../testing/execution-comparisons/cases/minimal-petri-net-editor/public-contract.json',
    import.meta.url,
  ),
);

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => await rm(root, { recursive: true, force: true })));
});

async function handoff(root: string): Promise<{ specificationPath: string; specification: Buffer }> {
  const handoffDir = join(root, 'handoffs', 'brunch_spec');
  await mkdir(handoffDir, { recursive: true });
  const specification = Buffer.from('# Free-form specification\n\nExact spacing survives.  \n');
  const specificationPath = join(handoffDir, 'spec.md');
  await writeFile(specificationPath, specification);
  return { specificationPath, specification };
}

describe('end-to-end execution adapters', () => {
  it('encodes brownfield Claude tool lists as single CLI option values', () => {
    const workspaceDir = '/tmp/brunch-brownfield-claude';
    const policy = createClaudeSolutionIsolationPolicy(workspaceDir, ['/tmp/controller']);
    const launch = createClaudeExecutionLaunch({ workspaceDir, isolationPolicy: policy });
    const allowedIndex = launch.args.indexOf('--allowedTools');
    const disallowedIndex = launch.args.indexOf('--disallowedTools');

    expect(launch.args[allowedIndex + 1]).toBe(policy.allowedTools.join(','));
    expect(launch.args[allowedIndex + 2]).toBe('--disallowedTools');
    expect(launch.args[disallowedIndex + 1]).toBe('WebFetch,WebSearch');
    expect(launch.args[disallowedIndex + 2]).toBe('--settings');
  });

  it('prepares Brunch from exact free-form bytes while preserving the legacy public packet', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-e2e-adapter-'));
    roots.push(root);
    const selected = await handoff(root);
    const controllerRoot = join(root, 'controller');
    const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
    const prepared = await prepareBrunchExecutionCell({
      cellRoot: join(root, 'cells', 'brunch-spec--brunch'),
      workspaceDir: join(root, 'targets', 'brunch'),
      controllerRoot,
      specificationPath: selected.specificationPath,
      publicContractTemplatePath: contractTemplatePath,
    });

    expect(await readFile(join(prepared.prepared.publicDir, 'spec.md'))).toEqual(selected.specification);
    expect(prepared.prepared.specId).toBe(1);
    expect(prepared.launch).toEqual({
      command: 'npx',
      args: [
        'tsx',
        'src/dev/execution-comparison-brunch.ts',
        '--workspace',
        join(root, 'targets', 'brunch'),
        '--spec-id',
        '1',
      ],
      cwd: repositoryRoot,
    });
  });

  it('prepares and finalizes an isolated Claude repository from the same exact packet', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-e2e-adapter-'));
    roots.push(root);
    const selected = await handoff(root);
    const workspaceDir = join(root, 'targets', 'claude');
    const controllerRoot = join(root, 'controller');
    const prepared = await prepareClaudeExecutionWorkspace({
      workspaceDir,
      controllerRoot,
      specificationPath: selected.specificationPath,
      publicContractTemplatePath: contractTemplatePath,
    });

    expect(await readFile(join(workspaceDir, 'spec.md'))).toEqual(selected.specification);
    expect((await readdir(workspaceDir)).sort()).toEqual(['.git', 'public-contract.json', 'spec.md']);
    expect(prepared.launch.command).toBe('claude');
    expect(prepared.launch.args).toEqual(
      expect.arrayContaining([
        '--print',
        '--verbose',
        '--output-format',
        'stream-json',
        '--model',
        'claude-opus-4-8',
        '--permission-mode',
        'bypassPermissions',
        '--no-session-persistence',
      ]),
    );
    expect(prepared.launch.args).not.toEqual(
      expect.arrayContaining(['--strict-mcp-config', '--settings', '--tools']),
    );
    expect(prepared.launch.args.at(-1)).not.toContain(controllerRoot);

    await writeFile(join(workspaceDir, 'package.json'), '{"scripts":{"test":"true","build":"true"}}\n');
    const finalized = await finalizeClaudeExecutionWorkspace({ workspaceDir });
    expect(finalized.baseSha).toBe(prepared.baseSha);
    expect(finalized.reviewSha).toMatch(/^[a-f0-9]{40}$/u);
    expect(finalized.reviewSha).not.toBe(finalized.baseSha);
    const status = await runCommand('git', ['status', '--porcelain'], { cwd: workspaceDir });
    expect(status).toMatchObject({ exitCode: 0, stdout: '' });
  });

  it('bounds a Claude run, captures both streams, retains output, and reports clean teardown', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-e2e-adapter-'));
    roots.push(root);
    const selected = await handoff(root);
    const prepared = await prepareClaudeExecutionWorkspace({
      workspaceDir: join(root, 'targets', 'claude'),
      controllerRoot: join(root, 'controller'),
      specificationPath: selected.specificationPath,
      publicContractTemplatePath: contractTemplatePath,
    });
    const runner: CommandRunner = async (command, args, options) => {
      if (command === 'claude') {
        await writeFile(join(options.cwd, 'package.json'), '{"scripts":{"test":"true","build":"true"}}\n');
        return {
          exitCode: 0,
          stdout: '{"type":"result","subtype":"success"}\n',
          stderr: 'provider note\n',
        };
      }
      return await runCommand(command, args, options);
    };
    const run = await runClaudeExecutionWorkspace(
      {
        prepared,
        evidenceDir: join(root, 'evidence'),
        elapsedMinutes: 90,
      },
      runner,
    );
    expect(await readFile(run.stdoutPath, 'utf8')).toContain('"subtype":"success"');
    expect(await readFile(run.stderrPath, 'utf8')).toBe('provider note\n');
    expect(run.repository?.finalGitRange).toMatch(/^[a-f0-9]{40}\.\.[a-f0-9]{40}$/u);
    expect(run.cleanup).toEqual({ status: 'clean', liveProcesses: 0, liveSessions: 0 });
  });

  it('rejects a target workspace or specification nested with controller material', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-e2e-adapter-'));
    roots.push(root);
    const selected = await handoff(root);
    await expect(
      prepareClaudeExecutionWorkspace({
        workspaceDir: join(root, 'controller', 'target'),
        controllerRoot: join(root, 'controller'),
        specificationPath: selected.specificationPath,
        publicContractTemplatePath: contractTemplatePath,
      }),
    ).rejects.toThrow('controller and target roots must be disjoint');
    await expect(
      prepareClaudeExecutionWorkspace({
        workspaceDir: join(root, 'targets', 'claude'),
        controllerRoot: join(root, 'handoffs'),
        specificationPath: selected.specificationPath,
        publicContractTemplatePath: contractTemplatePath,
      }),
    ).rejects.toThrow('specification may not come from the controller root');
  });
});
