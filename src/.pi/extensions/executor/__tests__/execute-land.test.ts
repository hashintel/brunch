import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createFakeGitHostLandPort } from '../../../../executor/__tests__/fake-ports.js';
import { promotionReportPath } from '../../../../executor/promotion.js';
import { runMetadataPath, runDirPath } from '../../../../executor/run.js';
import { createExecuteLandPreflightTool, runBrunchLandCommand } from '../execute-land/index.js';

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
