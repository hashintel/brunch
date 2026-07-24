import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createFakeGitHostLandPort } from '../../../../executor/__tests__/fake-ports.js';
import { promotionReportPath } from '../../../../executor/promotion.js';
import { runMetadataPath, runDirPath } from '../../../../executor/run.js';
import {
  createExecuteLandPreflightTool,
  registerBrunchExecuteLand,
  runBrunchLandCommand,
} from '../execute-land/index.js';

const TIP = 'tip456';

async function createPromotionPreparedRun(
  cwd: string,
  runId = 'run-1',
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const promotionPath = promotionReportPath(cwd, runId);
  await mkdir(dirname(promotionPath), { recursive: true });
  await mkdir(join(runDirPath(cwd, runId), 'worktree'), { recursive: true });
  await writeFile(
    runMetadataPath(cwd, runId),
    JSON.stringify({
      runId,
      specId: '42',
      planPath: '/tmp/plan.json',
      status: 'promotion_prepared',
      worktreeDir: join(runDirPath(cwd, runId), 'worktree'),
      runBaseSha: 'base123',
      promotionPath,
      promotionCommitSha: TIP,
      promotionBranch: `brunch/review/${runId}`,
      ...overrides,
    }),
    'utf8',
  );
  await writeFile(
    promotionPath,
    JSON.stringify({
      runId,
      specId: '42',
      promotion: { status: 'promoted', commitSha: TIP, reviewBranch: `brunch/review/${runId}` },
    }),
    'utf8',
  );
}

interface StubUi {
  readonly notifications: string[];
  readonly confirms: string[];
  confirmAnswer: boolean;
  inputAnswer: string | undefined;
}

function stubCtx(cwd: string, ui: StubUi, hasUI = true) {
  return {
    cwd,
    hasUI,
    ui: {
      confirm: async (title: string, message: string) => {
        ui.confirms.push(`${title}\n${message}`);
        return ui.confirmAnswer;
      },
      input: async () => ui.inputAnswer,
      notify: (message: string) => {
        ui.notifications.push(message);
      },
    },
  };
}

function makeUi(overrides: Partial<StubUi> = {}): StubUi {
  return { notifications: [], confirms: [], confirmAnswer: true, inputAnswer: undefined, ...overrides };
}

async function runStatus(cwd: string, runId = 'run-1'): Promise<string> {
  const metadata = JSON.parse(await readFile(runMetadataPath(cwd, runId), 'utf8')) as { status: string };
  return metadata.status;
}

describe('runBrunchLandCommand', () => {
  it('refuses landing under comparison policy before inspection or confirmation', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-land-cmd-comparison-'));
    await createPromotionPreparedRun(cwd);
    const ui = makeUi();
    const inspectCalls: unknown[] = [];
    const gitHostLand = createFakeGitHostLandPort({
      async inspect(args) {
        inspectCalls.push(args);
        return { status: 'failed', message: 'must not inspect', sideEffects: [] };
      },
    });

    await runBrunchLandCommand('run-1', stubCtx(cwd, ui), {
      gitHostLand,
      allowHostLanding: false,
    });

    expect(inspectCalls).toEqual([]);
    expect(ui.confirms).toEqual([]);
    expect(ui.notifications).toEqual(['Landing is disabled for isolated execution comparisons.']);
    await expect(runStatus(cwd)).resolves.toBe('promotion_prepared');
  });

  it('lands an explicit run after the user confirms', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-land-cmd-confirm-'));
    await createPromotionPreparedRun(cwd);
    const ui = makeUi();
    const integrateCalls: unknown[] = [];
    const gitHostLand = createFakeGitHostLandPort({
      async integrate(args) {
        integrateCalls.push(args);
        return {
          status: 'landed',
          via: 'fast_forward',
          branch: 'main',
          landedSha: args.expectedTipSha,
          sideEffects: [
            { kind: 'host_branch_advance', path: args.hostDir, branch: 'main', sha: args.expectedTipSha },
          ],
        };
      },
    });

    await runBrunchLandCommand('run-1', stubCtx(cwd, ui), { gitHostLand });

    expect(ui.confirms).toHaveLength(1);
    expect(ui.confirms[0]).toContain('run-1');
    expect(integrateCalls).toHaveLength(1);
    await expect(runStatus(cwd)).resolves.toBe('landed');
    expect(ui.notifications.join('\n')).toContain('Landed run-1');
  });

  it('shows full-range inspection evidence before asking for host-mutation confirmation', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-land-cmd-inspection-'));
    await createPromotionPreparedRun(cwd);
    const ui = makeUi({ confirmAnswer: false });
    const inspectCalls: unknown[] = [];
    const gitHostLand = createFakeGitHostLandPort({
      async inspect(args) {
        inspectCalls.push(args);
        return {
          status: 'inspected',
          runBaseSha: 'base123',
          reviewTipSha: TIP,
          commits: [
            { sha: 'slice-a', subject: 'brunch: integrate slice a' },
            { sha: 'slice-b', subject: 'brunch: integrate slice b' },
            { sha: TIP, subject: 'promote run-1' },
          ],
          changedPaths: [
            { status: 'A', path: 'src/a.ts' },
            { status: 'A', path: 'src/b.ts' },
          ],
          target: {
            kind: 'repository',
            path: cwd,
            branch: 'main',
            trackedDirtyPaths: [],
            untrackedPaths: [],
          },
          conflictRehearsal: { status: 'clean' },
          admissible: true,
          sideEffects: [],
        };
      },
    });

    await runBrunchLandCommand('run-1', stubCtx(cwd, ui), { gitHostLand });

    expect(inspectCalls).toEqual([
      {
        strategy: 'integrate',
        runWorktreeDir: join(runDirPath(cwd, 'run-1'), 'worktree'),
        reviewRef: 'brunch/review/run-1',
        runBaseSha: 'base123',
        expectedTipSha: TIP,
        targetDir: cwd,
      },
    ]);
    expect(ui.confirms).toHaveLength(1);
    expect(ui.confirms[0]).toContain('3 commits across the complete base123..tip456 range');
    expect(ui.confirms[0]).toContain('src/a.ts');
    expect(ui.confirms[0]).toContain('Target: repository main');
    expect(ui.confirms[0]).toContain('Conflict rehearsal: clean');
  });

  it('refuses a target argument for brownfield landing before inspection or confirmation', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-land-cmd-brownfield-target-'));
    await createPromotionPreparedRun(cwd);
    const ui = makeUi();
    const inspectCalls: unknown[] = [];
    const gitHostLand = createFakeGitHostLandPort({
      async inspect(args) {
        inspectCalls.push(args);
        return { status: 'failed', message: 'must not inspect', sideEffects: [] };
      },
    });

    await runBrunchLandCommand('run-1 /tmp/other-repository', stubCtx(cwd, ui), { gitHostLand });

    expect(inspectCalls).toHaveLength(0);
    expect(ui.confirms).toHaveLength(0);
    expect(ui.notifications.join('\n')).toContain('only accepts a target directory for greenfield runs');
    expect(ui.notifications.join('\n')).toContain(cwd);
    await expect(runStatus(cwd)).resolves.toBe('promotion_prepared');
  });

  it('does not offer confirmation when inspection predicts a merge conflict', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-land-cmd-conflict-inspection-'));
    await createPromotionPreparedRun(cwd);
    const ui = makeUi();
    const integrateCalls: unknown[] = [];
    const gitHostLand = createFakeGitHostLandPort({
      async inspect() {
        return {
          status: 'inspected',
          runBaseSha: 'base123',
          reviewTipSha: TIP,
          commits: [{ sha: TIP, subject: 'promote run-1' }],
          changedPaths: [{ status: 'M', path: 'src/a.ts' }],
          target: {
            kind: 'repository',
            path: cwd,
            branch: 'main',
            trackedDirtyPaths: [],
            untrackedPaths: [],
          },
          conflictRehearsal: { status: 'conflicts', paths: ['src/a.ts'] },
          admissible: false,
          sideEffects: [],
        };
      },
      async integrate(args) {
        integrateCalls.push(args);
        return { status: 'failed', message: 'must not run', sideEffects: [] };
      },
    });

    await runBrunchLandCommand('run-1', stubCtx(cwd, ui), { gitHostLand });

    expect(ui.confirms).toHaveLength(0);
    expect(integrateCalls).toHaveLength(0);
    expect(ui.notifications.join('\n')).toContain('src/a.ts');
    await expect(runStatus(cwd)).resolves.toBe('promotion_prepared');
  });

  it('notifies preflight refusals in command copy without the tool label', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-land-cmd-copy-'));
    await createPromotionPreparedRun(cwd, 'run-1', { status: 'petri_exported' });
    const ui = makeUi();

    await runBrunchLandCommand('run-1', stubCtx(cwd, ui), { gitHostLand: createFakeGitHostLandPort() });

    expect(ui.confirms).toHaveLength(0);
    const text = ui.notifications.join('\n');
    expect(text).not.toContain('execute_land_preflight');
    expect(text).toContain('run-1');
    expect(text).toContain('petri_exported');
  });

  it('performs zero mutation when the user declines', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-land-cmd-decline-'));
    await createPromotionPreparedRun(cwd);
    const ui = makeUi({ confirmAnswer: false });
    const integrateCalls: unknown[] = [];
    const gitHostLand = createFakeGitHostLandPort({
      async integrate(args) {
        integrateCalls.push(args);
        return { status: 'failed', message: 'must not run', sideEffects: [] };
      },
    });

    await runBrunchLandCommand('run-1', stubCtx(cwd, ui), { gitHostLand });

    expect(integrateCalls).toHaveLength(0);
    await expect(runStatus(cwd)).resolves.toBe('promotion_prepared');
  });

  it('performs zero mutation without an interactive UI', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-land-cmd-no-ui-'));
    await createPromotionPreparedRun(cwd);
    const ui = makeUi();

    await runBrunchLandCommand('run-1', stubCtx(cwd, ui, false), {
      gitHostLand: createFakeGitHostLandPort(),
    });

    expect(ui.confirms).toHaveLength(0);
    await expect(runStatus(cwd)).resolves.toBe('promotion_prepared');
    expect(ui.notifications.join('\n')).toContain('interactive');
  });

  it('resolves a sole promotion_prepared run when the runId is omitted', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-land-cmd-resolve-'));
    await createPromotionPreparedRun(cwd);
    const ui = makeUi();

    await runBrunchLandCommand('', stubCtx(cwd, ui), { gitHostLand: createFakeGitHostLandPort() });

    await expect(runStatus(cwd)).resolves.toBe('landed');
  });

  it('refuses an ambiguous omitted runId without mutation', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-land-cmd-ambiguous-'));
    await createPromotionPreparedRun(cwd, 'run-1');
    await createPromotionPreparedRun(cwd, 'run-2');
    const ui = makeUi();

    await runBrunchLandCommand('', stubCtx(cwd, ui), { gitHostLand: createFakeGitHostLandPort() });

    expect(ui.confirms).toHaveLength(0);
    await expect(runStatus(cwd, 'run-1')).resolves.toBe('promotion_prepared');
    await expect(runStatus(cwd, 'run-2')).resolves.toBe('promotion_prepared');
    expect(ui.notifications.join('\n')).toContain('run-1');
    expect(ui.notifications.join('\n')).toContain('run-2');
  });

  it('asks for a target directory for an empty_dir run and materializes into it', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-land-cmd-greenfield-'));
    await createPromotionPreparedRun(cwd, 'run-1', { substrate: 'empty_dir' });
    const targetDir = join(cwd, 'new-project');
    const ui = makeUi({ inputAnswer: targetDir });
    const materializeCalls: Array<{ targetDir: string }> = [];
    const gitHostLand = createFakeGitHostLandPort({
      async materialize(args) {
        materializeCalls.push({ targetDir: args.targetDir });
        return {
          status: 'landed',
          branch: args.branch,
          landedSha: 'green789',
          targetDir: args.targetDir,
          sideEffects: [
            { kind: 'git_materialize', path: args.targetDir, branch: args.branch, sha: 'green789' },
          ],
        };
      },
    });

    await runBrunchLandCommand('run-1', stubCtx(cwd, ui), { gitHostLand });

    expect(materializeCalls).toEqual([{ targetDir }]);
    await expect(runStatus(cwd)).resolves.toBe('landed');
  });

  it('preserves spaces in an explicit greenfield target through inspection and apply', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-land-cmd-greenfield-spaces-'));
    await createPromotionPreparedRun(cwd, 'run-1', { substrate: 'empty_dir' });
    const targetDir = join(cwd, 'new project');
    const ui = makeUi();
    const inspectTargets: string[] = [];
    const materializeTargets: string[] = [];
    const gitHostLand = createFakeGitHostLandPort({
      async inspect(args) {
        inspectTargets.push(args.targetDir);
        return {
          status: 'inspected',
          runBaseSha: args.runBaseSha,
          reviewTipSha: args.expectedTipSha,
          commits: [{ sha: args.expectedTipSha, subject: 'promote run-1' }],
          changedPaths: [],
          target: { kind: 'missing', path: args.targetDir },
          conflictRehearsal: { status: 'not_applicable' },
          admissible: true,
          sideEffects: [],
        };
      },
      async materialize(args) {
        materializeTargets.push(args.targetDir);
        return {
          status: 'landed',
          branch: args.branch,
          landedSha: 'green789',
          targetDir: args.targetDir,
          sideEffects: [
            { kind: 'git_materialize', path: args.targetDir, branch: args.branch, sha: 'green789' },
          ],
        };
      },
    });

    await runBrunchLandCommand(`run-1 ${targetDir}`, stubCtx(cwd, ui), { gitHostLand });

    expect(inspectTargets).toEqual([targetDir]);
    expect(materializeTargets).toEqual([targetDir]);
    await expect(runStatus(cwd)).resolves.toBe('landed');
  });

  it('offers confirmation for a verified prior greenfield materialization', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-land-cmd-greenfield-replay-'));
    await createPromotionPreparedRun(cwd, 'run-1', { substrate: 'empty_dir' });
    const targetDir = join(cwd, 'new-project');
    const ui = makeUi({ confirmAnswer: false });
    const inspectCalls: unknown[] = [];
    const gitHostLand = createFakeGitHostLandPort({
      async inspect(args) {
        inspectCalls.push(args);
        return {
          status: 'inspected',
          runBaseSha: 'base123',
          reviewTipSha: TIP,
          commits: [{ sha: TIP, subject: 'promote run-1' }],
          changedPaths: [{ status: 'A', path: 'src/a.ts' }],
          target: {
            kind: 'materialized_repository',
            path: targetDir,
            branch: 'main',
            landedSha: 'landed789',
          },
          conflictRehearsal: { status: 'not_applicable' },
          admissible: true,
          sideEffects: [],
        };
      },
    });

    await runBrunchLandCommand(`run-1 ${targetDir}`, stubCtx(cwd, ui), { gitHostLand });

    expect(inspectCalls).toEqual([
      {
        strategy: 'materialize',
        runWorktreeDir: join(runDirPath(cwd, 'run-1'), 'worktree'),
        reviewRef: 'brunch/review/run-1',
        runBaseSha: 'base123',
        expectedTipSha: TIP,
        targetDir,
        branch: 'main',
        message: 'brunch: land run-1',
      },
    ]);
    expect(ui.confirms).toHaveLength(1);
    expect(ui.confirms[0]).toContain('verified prior Brunch materialization');
    await expect(runStatus(cwd)).resolves.toBe('promotion_prepared');
  });
});

describe('registerBrunchExecuteLand', () => {
  it('registers no landing surface when host landing is disabled', () => {
    const commands: string[] = [];
    const tools: string[] = [];

    registerBrunchExecuteLand(
      {
        registerCommand: (name: string) => commands.push(name),
        registerTool: (tool: { name: string }) => tools.push(tool.name),
      } as never,
      createFakeGitHostLandPort(),
      { allowHostLanding: false },
    );

    expect(commands).toEqual([]);
    expect(tools).toEqual([]);
  });
});

describe('createExecuteLandPreflightTool', () => {
  it('renders landing readiness read-only and points at /brunch:land', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-land-preflight-tool-'));
    await createPromotionPreparedRun(cwd);

    const tool = createExecuteLandPreflightTool();
    const result = await tool.execute('call-1', { runId: 'run-1' }, undefined, undefined, {
      cwd,
    } as never);

    const first = result.content[0];
    const text = first && first.type === 'text' ? first.text : '';
    expect(text).toContain('preflight_ready');
    expect(text).toContain('/brunch:land');
    await expect(runStatus(cwd)).resolves.toBe('promotion_prepared');
  });
});
