import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { runCommand, type CommandRunner } from '../../../app/command-runner.js';
import {
  assertExecuteProjectionPlanReady,
  projectExecuteGraph,
} from '../../../executor/execute-projection.js';
import { openWorkspaceDb } from '../../../graph/index.js';
import { queryGraph } from '../../../graph/queries.js';
import { runClaudeExecutionWorkspace } from '../../end-to-end-comparison/claude-adapter.js';
import {
  createNetworkDeniedCommandRunner,
  type NetworkDeniedCommandRunner,
} from '../../end-to-end-comparison/solution-isolation.js';
import { isPetrinautOptimizationExecutionCaseContract } from '../case-contract.js';
import {
  HistoricalReplayTargetPreparationError,
  prepareHistoricalReplayTarget,
  type HistoricalReplayTargetDependencies,
} from '../historical-replay-target.js';
import { prepareExecutionTarget, resolveExecutionCase } from '../operator-cli.js';

const roots: string[] = [];
const frozenCasesRoot = fileURLToPath(
  new URL('../../../../testing/execution-comparisons/cases/', import.meta.url),
);

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => await rm(root, { recursive: true, force: true })));
});

describe('historical replay target preparation', () => {
  it('admits the exact two-commit prefix and returns a launchable Brunch target without installing', async () => {
    const fixture = await createBrunchFixture();
    const selected = await resolveExecutionCase('brunch-host-landing', fixture.casesRoot);
    let installCalled = false;

    const ready = await prepareHistoricalReplayTarget(
      {
        lane: 'brunch',
        selectedCase: selected,
        sourceRepositoryDir: fixture.sourceDir,
        targetDir: fixture.targetDir,
        controllerRoot: fixture.controllerDir,
      },
      portableDependencies({
        dependencyInstallRunner: async () => {
          installCalled = true;
          return { exitCode: 0, stdout: '', stderr: '' };
        },
      }),
    );
    if (ready.lane !== 'brunch') throw new Error('expected a Brunch-ready target');

    expect(ready).toMatchObject({
      status: 'ready',
      lane: 'brunch',
      caseId: 'brunch-host-landing-v1',
      sourceCommit: fixture.sourceCommit,
      sourceTree: fixture.sourceTree,
      specId: expect.any(Number),
      dependencyPreparation: { recipe: 'none', status: 'not_required' },
      isolationPolicy: { executor: 'brunch' },
      launch: {
        command: 'npx',
        args: expect.arrayContaining([
          '--workspace',
          fixture.targetDir,
          '--spec-id',
          expect.any(String),
          '--solution-isolation',
          'v1',
        ]),
      },
    });
    expect(ready.specId).toBeGreaterThan(0);
    expect(ready.baseSha).toBe(await git(fixture.targetDir, ['rev-parse', 'HEAD']));
    expect(await git(fixture.targetDir, ['rev-list', '--count', ready.baseSha])).toBe('2');
    expect(await git(fixture.targetDir, ['rev-parse', `${ready.baseSha}^`])).toBe(ready.materializedCommit);
    expect(
      (await git(fixture.targetDir, ['diff', '--name-only', ready.materializedCommit, ready.baseSha])).split(
        '\n',
      ),
    ).toEqual(['public-contract.json', 'spec.md']);
    expect(await readFile(join(fixture.targetDir, 'spec.md'))).toEqual(fixture.specification);
    expect(installCalled).toBe(false);
    const graph = queryGraph(await openWorkspaceDb(fixture.targetDir), ready.specId);
    expect(graph.nodes.find(({ source }) => source === 'e2e-handoff [exact-spec]')).toMatchObject({
      kind: 'requirement',
      body: fixture.specification.toString('utf8'),
    });
    const projection = projectExecuteGraph({
      specId: ready.specId,
      graphLsn: graph.lsn,
      mode: 'brownfield',
      nodes: graph.nodes,
      edges: graph.edges,
    });
    expect(() => assertExecuteProjectionPlanReady(projection)).not.toThrow();
  }, 30_000);

  it('executes the production deep operation through an injected branded verifier factory', async () => {
    const fixture = await createBrunchFixture();
    const selected = await resolveExecutionCase('brunch-host-landing', fixture.casesRoot);
    let factoryCalls = 0;

    const ready = await prepareHistoricalReplayTarget(
      {
        lane: 'claude_code',
        selectedCase: selected,
        sourceRepositoryDir: fixture.sourceDir,
        targetDir: fixture.targetDir,
        controllerRoot: fixture.controllerDir,
      },
      {
        createVerifier: (forbiddenReadRoots: readonly string[]) => {
          factoryCalls += 1;
          return createNetworkDeniedCommandRunner({
            platform: 'darwin',
            forbiddenReadRoots,
            run: fakeSandboxRunner,
          });
        },
      },
    );

    expect(factoryCalls).toBe(1);
    expect(ready).toMatchObject({
      status: 'ready',
      lane: 'claude_code',
      baseSha: expect.stringMatching(/^[a-f0-9]{40}$/u),
    });
  });

  it('rejects an injected raw verifier that lacks the existing runtime brand', async () => {
    const fixture = await createBrunchFixture();
    const selected = await resolveExecutionCase('brunch-host-landing', fixture.casesRoot);

    const rejected = prepareHistoricalReplayTarget(
      {
        lane: 'claude_code',
        selectedCase: selected,
        sourceRepositoryDir: fixture.sourceDir,
        targetDir: fixture.targetDir,
        controllerRoot: fixture.controllerDir,
      },
      portableDependencies({
        createVerifier: (forbiddenReadRoots) =>
          ({
            recipeVersion: 1,
            platform: 'darwin',
            forbiddenReadRoots,
            run: fakeSandboxRunner,
          }) as unknown as NetworkDeniedCommandRunner,
      }),
    );

    await expect(rejected).rejects.toMatchObject({
      status: 'setup_failed',
      phase: 'admission',
      reasons: expect.arrayContaining([expect.objectContaining({ code: 'policy_weakened' })]),
    });
  });

  it('rejects readiness when a branded verifier reaches a required network probe', async () => {
    const fixture = await createBrunchFixture();
    const selected = await resolveExecutionCase('brunch-host-landing', fixture.casesRoot);
    let reachedRequiredProbe = false;
    const reachableSandboxRunner: CommandRunner = async (command, args) => {
      if (command !== 'sandbox-exec') {
        throw new Error(`unexpected verifier command: ${command}`);
      }
      const verifiedCommand = args[2];
      if (verifiedCommand === '/usr/bin/curl' && args[3] === '--version') {
        return { exitCode: 0, stdout: 'curl fake\n', stderr: '' };
      }
      if (verifiedCommand === '/usr/bin/curl' && args.at(-1) === 'https://github.com') {
        reachedRequiredProbe = true;
        return { exitCode: 0, stdout: 'reachable\n', stderr: '' };
      }
      return { exitCode: 1, stdout: '', stderr: 'denied by fake sandbox\n' };
    };

    const rejected = prepareHistoricalReplayTarget(
      {
        lane: 'claude_code',
        selectedCase: selected,
        sourceRepositoryDir: fixture.sourceDir,
        targetDir: fixture.targetDir,
        controllerRoot: fixture.controllerDir,
      },
      {
        createVerifier: (forbiddenReadRoots) =>
          createNetworkDeniedCommandRunner({
            platform: 'darwin',
            forbiddenReadRoots,
            run: reachableSandboxRunner,
          }),
      },
    );

    await expect(rejected).rejects.toMatchObject({
      status: 'setup_failed',
      phase: 'admission',
      reasons: [
        expect.objectContaining({
          code: 'network_probe_reachable',
          detail: 'https://github.com',
        }),
      ],
    });
    expect(reachedRequiredProbe).toBe(true);
    await expect(readFile(join(fixture.targetDir, 'spec.md'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('dispatches pinned preparation by repository substrate for the Brunch host-landing case', async () => {
    const fixture = await createBrunchFixture();

    const ready = await prepareExecutionTarget(
      {
        lane: 'claude_code',
        caseReference: 'brunch-host-landing',
        casesRoot: fixture.casesRoot,
        sourceRepositoryDir: fixture.sourceDir,
        targetDir: fixture.targetDir,
        controllerRoot: fixture.controllerDir,
      },
      portableDependencies({
        dependencyInstallRunner: async () => {
          throw new Error('Brunch host landing must not install dependencies');
        },
      }),
    );

    expect(ready).toMatchObject({
      status: 'ready',
      preparation: 'historical_replay',
      lane: 'claude_code',
      caseId: 'brunch-host-landing-v1',
      dependencyPreparation: { recipe: 'none', status: 'not_required' },
      isolationPolicy: {
        executor: 'claude_code',
        strictMcp: true,
        webTools: false,
        ambientSettings: false,
        ambientPlugins: false,
        permissionMode: 'dontAsk',
      },
      launch: { command: 'claude', cwd: fixture.targetDir },
    });
    expect('specId' in ready).toBe(false);
    if (ready.preparation !== 'historical_replay' || ready.lane !== 'claude_code') {
      throw new Error('expected a Claude-ready historical replay target');
    }
    const run = await runClaudeExecutionWorkspace(
      {
        prepared: ready,
        evidenceDir: join(fixture.controllerDir, 'evidence'),
        elapsedMinutes: 1,
      },
      async (command, args, options) => {
        if (command === 'claude') {
          await writeFile(join(options.cwd, 'candidate.ts'), 'export const candidate = true;\n');
          return { exitCode: 0, stdout: '{"type":"result","subtype":"success"}\n', stderr: '' };
        }
        return await runCommand(command, args, options);
      },
    );
    expect(run.repository?.finalGitRange).toMatch(new RegExp(`^${ready.baseSha}\\.\\.[a-f0-9]{40}$`, 'u'));
  }, 30_000);

  it.each([
    ['wrong parent', rewritePrefixWithWrongParent, 'identity_mismatch'],
    ['packet drift', driftPacketCommit, 'identity_mismatch'],
    ['third commit', appendThirdCommit, 'git_history_present'],
    ['remote and later ref', addRemoteAndRef, 'git_remote_present'],
    ['escaping symlink', addEscapingSymlink, 'path_boundary_weakened'],
  ] as const)(
    'rejects a %s before lane readiness and removes the partial target',
    async (_name, mutate, reason) => {
      const fixture = await createBrunchFixture();
      const selected = await resolveExecutionCase('brunch-host-landing', fixture.casesRoot);
      let mutated = false;
      const runner: CommandRunner = async (command, args, options) => {
        if (
          !mutated &&
          command === 'git' &&
          args[0] === 'rev-list' &&
          args[1] === '--count' &&
          args[2] === 'HEAD' &&
          options.cwd === fixture.targetDir
        ) {
          mutated = true;
          await mutate(fixture.targetDir);
        }
        return await runCommand(command, args, options);
      };

      const rejected = prepareHistoricalReplayTarget(
        {
          lane: 'claude_code',
          selectedCase: selected,
          sourceRepositoryDir: fixture.sourceDir,
          targetDir: fixture.targetDir,
          controllerRoot: fixture.controllerDir,
        },
        portableDependencies({ runner }),
      );

      await expect(rejected).rejects.toMatchObject({
        status: 'setup_failed',
        phase: 'admission',
        reasons: expect.arrayContaining([expect.objectContaining({ code: reason })]),
      });
      await expect(readFile(join(fixture.targetDir, 'spec.md'))).rejects.toMatchObject({ code: 'ENOENT' });
    },
    30_000,
  );

  it('retains path-boundary setup evidence without returning a partial launch descriptor', async () => {
    const fixture = await createBrunchFixture();
    const selected = await resolveExecutionCase('brunch-host-landing', fixture.casesRoot);

    const rejected = prepareHistoricalReplayTarget(
      {
        lane: 'brunch',
        selectedCase: selected,
        sourceRepositoryDir: fixture.sourceDir,
        targetDir: fixture.targetDir,
        controllerRoot: fixture.controllerDir,
        forbiddenRoots: [join(fixture.targetDir, 'nested-controller')],
      },
      portableDependencies(),
    );

    await expect(rejected).rejects.toBeInstanceOf(HistoricalReplayTargetPreparationError);
    await expect(rejected).rejects.toMatchObject({
      status: 'setup_failed',
      phase: 'admission',
      reasons: expect.arrayContaining([expect.objectContaining({ code: 'path_boundary_weakened' })]),
    });
    await expect(readFile(join(fixture.targetDir, 'spec.md'))).rejects.toMatchObject({ code: 'ENOENT' });
  }, 30_000);

  it('rejects a pre-existing target without deleting caller-owned files', async () => {
    const fixture = await createBrunchFixture();
    const selected = await resolveExecutionCase('brunch-host-landing', fixture.casesRoot);
    await mkdir(fixture.targetDir);
    await writeFile(join(fixture.targetDir, 'keep.txt'), 'caller owned\n');

    await expect(
      prepareHistoricalReplayTarget(
        {
          lane: 'brunch',
          selectedCase: selected,
          sourceRepositoryDir: fixture.sourceDir,
          targetDir: fixture.targetDir,
          controllerRoot: fixture.controllerDir,
        },
        portableDependencies(),
      ),
    ).rejects.toMatchObject({
      status: 'setup_failed',
      phase: 'source_materialization',
    });
    await expect(readFile(join(fixture.targetDir, 'keep.txt'), 'utf8')).resolves.toBe('caller owned\n');
  });

  it('admits non-ignored untracked Petrinaut dependency artifacts when tracked source stays clean', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-petrinaut-replay-'));
    roots.push(root);
    const sourceDir = join(root, 'source');
    const controllerDir = join(root, 'controller');
    const targetDir = join(root, 'target');
    await Promise.all([mkdir(sourceDir), mkdir(controllerDir)]);
    const selected = await resolveExecutionCase('petrinaut-optimization-v1', frozenCasesRoot);
    if (!isPetrinautOptimizationExecutionCaseContract(selected.packet.contract)) {
      throw new Error('expected the frozen Petrinaut contract');
    }
    const runner = createSyntheticPinnedGitRunner({
      sourceDir,
      targetDir,
      sourceCommit: selected.packet.contract.case.repository.parentCommit,
      sourceTree: selected.packet.contract.case.repository.parentTree,
      reportUntrackedArtifact: true,
    });
    const installCalls: { command: string; args: readonly string[]; cwd: string }[] = [];

    const ready = await prepareHistoricalReplayTarget(
      {
        lane: 'claude_code',
        selectedCase: selected,
        sourceRepositoryDir: sourceDir,
        targetDir,
        controllerRoot: controllerDir,
      },
      portableDependencies({
        runner,
        dependencyInstallRunner: async (command, args, options) => {
          installCalls.push({ command, args, cwd: options.cwd });
          await writeFile(join(options.cwd, '.pnp.cjs'), '// generated dependency artifact\n');
          return { exitCode: 0, stdout: '', stderr: '' };
        },
      }),
    );

    expect(installCalls).toEqual([
      {
        command: 'corepack',
        args: ['yarn', 'install', '--immutable', '--mode=skip-build'],
        cwd: targetDir,
      },
    ]);
    await expect(readFile(join(targetDir, '.pnp.cjs'), 'utf8')).resolves.toBe(
      '// generated dependency artifact\n',
    );
    expect(ready).toMatchObject({
      status: 'ready',
      lane: 'claude_code',
      dependencyPreparation: {
        recipe: 'petrinaut-yarn-immutable-v1',
        command: 'corepack',
        args: ['yarn', 'install', '--immutable', '--mode=skip-build'],
        status: 'passed',
        exitCode: 0,
      },
      isolationPolicy: {
        executor: 'claude_code',
        strictMcp: true,
        mcpServers: [],
        webTools: false,
        ambientSettings: false,
        ambientPlugins: false,
        permissionMode: 'dontAsk',
        nativeSandbox: {
          enabled: true,
          failIfUnavailable: true,
          allowedDomains: [],
        },
      },
      launch: { command: 'claude', cwd: targetDir },
    });
    expect('specId' in ready).toBe(false);
  }, 30_000);

  it('rejects Petrinaut dependency preparation that mutates tracked source', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-petrinaut-mutation-'));
    roots.push(root);
    const sourceDir = join(root, 'source');
    const controllerDir = join(root, 'controller');
    const targetDir = join(root, 'target');
    await Promise.all([mkdir(sourceDir), mkdir(controllerDir)]);
    const selected = await resolveExecutionCase('petrinaut-optimization-v1', frozenCasesRoot);
    if (!isPetrinautOptimizationExecutionCaseContract(selected.packet.contract)) {
      throw new Error('expected the frozen Petrinaut contract');
    }

    const rejected = prepareHistoricalReplayTarget(
      {
        lane: 'claude_code',
        selectedCase: selected,
        sourceRepositoryDir: sourceDir,
        targetDir,
        controllerRoot: controllerDir,
      },
      portableDependencies({
        runner: createSyntheticPinnedGitRunner({
          sourceDir,
          targetDir,
          sourceCommit: selected.packet.contract.case.repository.parentCommit,
          sourceTree: selected.packet.contract.case.repository.parentTree,
          detectTrackedMutation: true,
        }),
        dependencyInstallRunner: async (_command, _args, options) => {
          await writeFile(join(options.cwd, 'package.json'), '{"mutated":true}\n');
          return { exitCode: 0, stdout: '', stderr: '' };
        },
      }),
    );

    await expect(rejected).rejects.toMatchObject({
      status: 'setup_failed',
      phase: 'dependency_preparation',
    });
    await expect(rejected).rejects.toThrow('modified tracked source');
    await expect(readFile(join(targetDir, 'package.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  }, 30_000);
});

async function createBrunchFixture(): Promise<{
  readonly casesRoot: string;
  readonly controllerDir: string;
  readonly sourceDir: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly targetDir: string;
  readonly specification: Buffer;
}> {
  const root = await mkdtemp(join(tmpdir(), 'brunch-historical-replay-'));
  roots.push(root);
  const sourceDir = join(root, 'source');
  const controllerDir = join(root, 'controller');
  const casesRoot = join(root, 'cases');
  const caseDir = join(casesRoot, 'brunch-host-landing');
  const targetDir = join(root, 'target');
  await Promise.all([mkdir(sourceDir), mkdir(controllerDir), mkdir(caseDir, { recursive: true })]);
  await writeFile(join(sourceDir, 'package.json'), '{"name":"historical-source","private":true}\n');
  await writeFile(join(sourceDir, 'source.ts'), 'export const historical = true;\n');
  await git(sourceDir, ['init', '--initial-branch=main']);
  await git(sourceDir, ['add', '--all']);
  await git(sourceDir, [
    '-c',
    'user.name=Historical Fixture',
    '-c',
    'user.email=historical@example.invalid',
    'commit',
    '-m',
    'Pinned source',
  ]);
  const sourceCommit = await git(sourceDir, ['rev-parse', 'HEAD']);
  const sourceTree = await git(sourceDir, ['rev-parse', 'HEAD^{tree}']);
  const specification = Buffer.from('# Exact approved host landing specification\n\nBytes survive.  \n');
  await writeFile(join(caseDir, 'spec.md'), specification);
  await writeFile(
    join(caseDir, 'public-contract.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        case: {
          id: 'brunch-host-landing-v1',
          specification: 'spec.md',
          specificationSha256: createHash('sha256').update(specification).digest('hex'),
          provider: 'anthropic',
          model: 'claude-opus-4-8',
          product: 'brunch',
          mode: 'brownfield',
          scope: 'single_feature',
          surface: 'backend',
          repository: {
            substrate: 'pinned_git',
            parentCommit: sourceCommit,
            parentTree: sourceTree,
          },
        },
        budgets: {
          elapsedMinutes: 90,
          mechanicalInterventions: 2,
          substantiveHumanInterventions: 0,
        },
        delivery: {
          runtimeNetwork: 'forbidden',
          dependencyInstallNetwork: 'forbidden',
        },
        acceptance: {
          publicCommand: '/brunch:land',
          executionTerminal: 'promotion_prepared',
        },
        rules: ['Work only in the target repository.', 'Stop after promotion_prepared without landing.'],
      },
      null,
      2,
    )}\n`,
  );
  return {
    casesRoot,
    controllerDir,
    sourceDir,
    sourceCommit,
    sourceTree,
    targetDir,
    specification,
  };
}

async function git(cwd: string, args: readonly string[]): Promise<string> {
  const result = await runCommand('git', args, { cwd });
  if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

async function appendThirdCommit(targetDir: string): Promise<void> {
  await git(targetDir, [
    '-c',
    'user.name=Historical Rival',
    '-c',
    'user.email=historical-rival@example.invalid',
    'commit',
    '--allow-empty',
    '-m',
    'Third commit rival',
  ]);
}

async function driftPacketCommit(targetDir: string): Promise<void> {
  await writeFile(join(targetDir, 'spec.md'), '# Drifted packet\n');
  await git(targetDir, ['add', '--', 'spec.md']);
  await git(targetDir, [
    '-c',
    'user.name=Historical Rival',
    '-c',
    'user.email=historical-rival@example.invalid',
    'commit',
    '--amend',
    '--no-edit',
  ]);
}

async function rewritePrefixWithWrongParent(targetDir: string): Promise<void> {
  const originalRootTree = await git(targetDir, ['rev-parse', 'HEAD^^{tree}']);
  const finalTree = await git(targetDir, ['rev-parse', 'HEAD^{tree}']);
  const replacementRoot = await git(targetDir, [
    '-c',
    'user.name=Historical Rival',
    '-c',
    'user.email=historical-rival@example.invalid',
    'commit-tree',
    originalRootTree,
    '-m',
    'Replacement root',
  ]);
  const replacementChild = await git(targetDir, [
    '-c',
    'user.name=Historical Rival',
    '-c',
    'user.email=historical-rival@example.invalid',
    'commit-tree',
    finalTree,
    '-p',
    replacementRoot,
    '-m',
    'Replacement packet child',
  ]);
  await git(targetDir, ['update-ref', 'refs/heads/main', replacementChild]);
}

async function addRemoteAndRef(targetDir: string): Promise<void> {
  await git(targetDir, ['remote', 'add', 'origin', 'https://github.com/hashintel/brunch.git']);
  await git(targetDir, ['branch', 'later-solution']);
}

async function addEscapingSymlink(targetDir: string): Promise<void> {
  await symlink('../controller', join(targetDir, 'escaped-controller'));
}

function createSyntheticPinnedGitRunner(input: {
  readonly sourceDir: string;
  readonly targetDir: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly detectTrackedMutation?: boolean;
  readonly reportUntrackedArtifact?: boolean;
}): CommandRunner {
  const materializedCommit = 'a'.repeat(40);
  const baseSha = 'b'.repeat(40);
  let commits = 0;
  return async (command, args, options) => {
    if (command === 'tar') {
      await writeFile(join(options.cwd, 'package.json'), '{"private":true}\n');
      return { exitCode: 0, stdout: '', stderr: '' };
    }
    if (command !== 'git') {
      return await runCommand(command, args, options);
    }
    if (args[0] === 'archive') {
      const output = args.find((arg) => arg.startsWith('--output='))?.slice('--output='.length);
      if (output === undefined) throw new Error('synthetic archive call omitted --output');
      await writeFile(output, 'synthetic archive');
      return { exitCode: 0, stdout: '', stderr: '' };
    }
    if (args[0] === 'rev-parse' && options.cwd === input.sourceDir) {
      const revision = args.at(-1);
      if (revision === `${input.sourceCommit}^{commit}`) {
        return { exitCode: 0, stdout: `${input.sourceCommit}\n`, stderr: '' };
      }
      if (revision === `${input.sourceCommit}^{tree}`) {
        return { exitCode: 0, stdout: `${input.sourceTree}\n`, stderr: '' };
      }
    }
    if (args.includes('commit')) {
      commits += 1;
      return { exitCode: 0, stdout: '', stderr: '' };
    }
    if (args[0] === 'rev-parse') {
      const revision = args.at(-1);
      if (revision === 'HEAD') {
        return {
          exitCode: 0,
          stdout: `${commits === 1 ? materializedCommit : baseSha}\n`,
          stderr: '',
        };
      }
      if (revision === `${baseSha}^`) {
        return { exitCode: 0, stdout: `${materializedCommit}\n`, stderr: '' };
      }
    }
    if (args[0] === 'rev-list' && args[1] === '--count') {
      return { exitCode: 0, stdout: '2\n', stderr: '' };
    }
    if (args[0] === 'rev-list' && args[1] === '--max-parents=0') {
      return { exitCode: 0, stdout: `${materializedCommit}\n`, stderr: '' };
    }
    if (args[0] === 'diff') {
      return { exitCode: 0, stdout: 'public-contract.json\nspec.md\n', stderr: '' };
    }
    if (args[0] === 'for-each-ref') {
      return { exitCode: 0, stdout: 'refs/heads/main\n', stderr: '' };
    }
    if (args[0] === 'status') {
      if (
        input.detectTrackedMutation === true &&
        (await readFile(join(input.targetDir, 'package.json'), 'utf8')) !== '{"private":true}\n'
      ) {
        return { exitCode: 0, stdout: ' M package.json\n', stderr: '' };
      }
      if (input.reportUntrackedArtifact === true && !args.includes('--untracked-files=no')) {
        return { exitCode: 0, stdout: '?? .pnp.cjs\n', stderr: '' };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    }
    if (args[0] === 'remote') {
      return { exitCode: 0, stdout: '', stderr: '' };
    }
    return { exitCode: 0, stdout: '', stderr: '' };
  };
}

function portableDependencies(
  overrides: HistoricalReplayTargetDependencies = {},
): HistoricalReplayTargetDependencies {
  return {
    createVerifier: (forbiddenReadRoots) =>
      createNetworkDeniedCommandRunner({
        platform: 'darwin',
        forbiddenReadRoots,
        run: fakeSandboxRunner,
      }),
    ...overrides,
  };
}

const fakeSandboxRunner: CommandRunner = async (command, args) => {
  if (command !== 'sandbox-exec') {
    throw new Error(`unexpected verifier command: ${command}`);
  }
  const verifiedCommand = args[2];
  if (verifiedCommand === '/usr/bin/curl' && args[3] === '--version') {
    return { exitCode: 0, stdout: 'curl fake\n', stderr: '' };
  }
  return { exitCode: 1, stdout: '', stderr: 'denied by fake sandbox\n' };
};
