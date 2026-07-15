import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { createWorkspaceSessionCoordinator } from '../session/workspace-session-coordinator.js';
import {
  aggregateCampaign,
  campaignActorStep,
  parseCampaignManifest,
  type CampaignArm,
  type CampaignManifest,
  type CampaignRunResult,
} from './consequential-fact-campaign.js';
import { writeConsequentialFactEvaluation } from './consequential-fact-evaluator.js';
import { parseTrajectoryReport, writeTrajectoryReport } from './trajectory-report.js';
import {
  renderScreenFromLog,
  sendKeys,
  sendText,
  startSession,
  stopSession,
  type TuiDriverKey,
} from './tui-driver.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCENARIO = resolve(REPO_ROOT, 'src/dev/consequential-fact-evaluator/review-diff-scenario.json');
type ActorAction =
  | { readonly kind: 'type_text'; readonly text: string; readonly submit: true }
  | { readonly kind: 'press_key'; readonly key: TuiDriverKey };

export interface CampaignRunnerPort {
  start(input: {
    name: string;
    workspace: string;
    arm: CampaignArm;
    cols: number;
    rows: number;
  }): Promise<{ readonly logPath: string }>;
  screen(logPath: string, cols: number, rows: number): Promise<string>;
  act(name: string, action: ActorAction): Promise<void>;
  stop(name: string): Promise<void>;
  collect(input: {
    manifest: CampaignManifest;
    runId: string;
    arm: CampaignArm;
    workspace: string;
    viewport: string;
  }): Promise<CampaignRunResult>;
}

export async function runConsequentialFactCampaign(
  manifestValue: unknown,
  port: CampaignRunnerPort = productionPort(),
): Promise<ReturnType<typeof aggregateCampaign>> {
  const manifest = parseCampaignManifest(manifestValue);
  const results: CampaignRunResult[] = [];
  for (const run of manifest.runs) {
    const workspace = resolve(
      REPO_ROOT,
      '.fixtures/scratch/consequential-fact-ablation',
      manifest.campaignId,
      'workspaces',
      run.runId,
    );
    const name = `fe1208-${run.runId}`;
    let started = false;
    let viewport = '';
    try {
      const session = await port.start({
        name,
        workspace,
        arm: run.arm,
        cols: manifest.tui.cols,
        rows: manifest.tui.rows,
      });
      started = true;
      viewport = await waitForSelectedNewSpecification(port, session.logPath, manifest);
      await port.act(name, { kind: 'press_key', key: 'Enter' });
      viewport = await waitForRecognizedScreen(port, session.logPath, manifest, 'New specification title');
      await port.act(name, { kind: 'type_text', text: 'Review Diff', submit: true });
      viewport = await waitForRecognizedScreen(
        port,
        session.logPath,
        manifest,
        'Is this a fresh, greenfield specification?',
      );
      await port.act(name, { kind: 'press_key', key: 'Enter' });
      viewport = await waitForSelectedOrientation(port, session.logPath, manifest);
      await port.act(name, { kind: 'press_key', key: 'Enter' });

      let turnsUsed = 0;
      viewport = await waitForScreenClass(port, session.logPath, manifest, 'question');
      const reveal = campaignActorStep({ state: 'awaiting_question', visibleText: viewport, turnsUsed });
      turnsUsed += 1;
      if (reveal.classification !== 'qualifying' || reveal.action.kind !== 'type_text') {
        throw new Error('mechanically invalid: startup did not reach a qualifying question');
      }
      await port.act(name, reveal.action);

      viewport = await waitForScreenClass(port, session.logPath, manifest, 'review');
      const approval = campaignActorStep({ state: 'awaiting_review', visibleText: viewport, turnsUsed });
      if (approval.classification !== 'review_exact' || approval.action.kind !== 'press_key') {
        throw new Error('mechanically invalid: review set did not carry the revealed constraint');
      }
      await port.act(name, approval.action);
      viewport = await waitForRecognizedScreen(port, session.logPath, manifest, 'Review: accepted');
      results.push(await port.collect({ manifest, runId: run.runId, arm: run.arm, workspace, viewport }));
    } finally {
      if (started) await port.stop(name);
    }
  }
  const aggregate = aggregateCampaign(manifest, results);
  const root = resolve(REPO_ROOT, manifest.artifactRoot);
  await mkdir(root, { recursive: true });
  await writeFile(join(root, 'aggregate-input.json'), `${JSON.stringify(results, null, 2)}\n`);
  await writeFile(join(root, 'aggregate.json'), `${JSON.stringify(aggregate, null, 2)}\n`);
  return aggregate;
}

async function waitForScreenClass(
  port: CampaignRunnerPort,
  logPath: string,
  manifest: CampaignManifest,
  expected: 'question' | 'review',
): Promise<string> {
  const deadline = Date.now() + manifest.timeoutMs;
  while (Date.now() < deadline) {
    const screen = await port.screen(logPath, manifest.tui.cols, manifest.tui.rows);
    const recognized =
      expected === 'question'
        ? /compliance|audit|regulat|constraint|missing requirement/iu.test(screen)
        : /Review set|Approve|Request changes/iu.test(screen);
    if (recognized) return screen;
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`mechanically invalid: timed out awaiting recognized ${expected} screen`);
}

async function waitForSelectedNewSpecification(
  port: CampaignRunnerPort,
  logPath: string,
  manifest: CampaignManifest,
): Promise<string> {
  const title = 'Choose a specification';
  const deadline = Date.now() + manifest.timeoutMs;
  while (Date.now() < deadline) {
    const screen = await port.screen(logPath, manifest.tui.cols, manifest.tui.rows);
    if (screen.includes(title)) {
      if (!/^\s*│\s*› Start a new specification(?:\s|$)/mu.test(screen))
        throw new Error('mechanically invalid: Start a new specification is not selected');
      return screen;
    }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`mechanically invalid: timed out awaiting ${title}`);
}

async function waitForSelectedOrientation(
  port: CampaignRunnerPort,
  logPath: string,
  manifest: CampaignManifest,
): Promise<string> {
  const title = 'Choose how Specify mode should continue';
  const deadline = Date.now() + manifest.timeoutMs;
  while (Date.now() < deadline) {
    const screen = await port.screen(logPath, manifest.tui.cols, manifest.tui.rows);
    if (screen.includes(title)) {
      if (!/^\s*│\s*› Work by decision(?:\s|$)/mu.test(screen))
        throw new Error('mechanically invalid: Work by decision is not the selected orientation');
      return screen;
    }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`mechanically invalid: timed out awaiting ${title}`);
}

async function waitForRecognizedScreen(
  port: CampaignRunnerPort,
  logPath: string,
  manifest: CampaignManifest,
  text: string,
): Promise<string> {
  const deadline = Date.now() + manifest.timeoutMs;
  while (Date.now() < deadline) {
    const screen = await port.screen(logPath, manifest.tui.cols, manifest.tui.rows);
    if (screen.includes(text)) return screen;
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`mechanically invalid: timed out awaiting ${text}`);
}

function productionPort(): CampaignRunnerPort {
  return {
    async start(input) {
      await mkdir(input.workspace, { recursive: true });
      const status = await startSession({
        name: input.name,
        cols: input.cols,
        rows: input.rows,
        cwd: REPO_ROOT,
        command: [
          'npm',
          'run',
          'dev-cli',
          '--',
          '--workspace',
          input.workspace,
          '--no-webui',
          '--dev-tools',
          '--evaluation-arm',
          input.arm,
        ],
      });
      return { logPath: status.logPath };
    },
    async screen(logPath, cols, rows) {
      return (await renderScreenFromLog(logPath, cols, rows)).join('\n');
    },
    async act(name, action) {
      if (action.kind === 'type_text') {
        sendText(name, action.text);
        if (action.submit) sendKeys(name, ['Enter']);
      } else sendKeys(name, [action.key]);
    },
    async stop(name) {
      if (!(await stopSession(name))) throw new Error(`mechanically invalid: ${name} did not stop`);
    },
    async collect(input) {
      const inventory = await createWorkspaceSessionCoordinator({ cwd: input.workspace }).inspectWorkspace();
      if (!inventory.currentSpec || !inventory.currentSessionFile)
        throw new Error('mechanically invalid: active spec/session unavailable');
      const viewportFile = resolve(input.workspace, '.brunch/debug/campaign-viewport.txt');
      await mkdir(dirname(viewportFile), { recursive: true });
      await writeFile(viewportFile, input.viewport);
      const trajectoryDir = await writeTrajectoryReport({
        repoRoot: REPO_ROOT,
        workspace: input.workspace,
        sessionFile: inventory.currentSessionFile,
        runId: input.runId,
        viewport: viewportFile,
      });
      const trajectoryFile = join(trajectoryDir, 'trajectory.json');
      const trajectory = parseTrajectoryReport(JSON.parse(await readFile(trajectoryFile, 'utf8')) as unknown);
      assertCampaignDirectiveEvidence(input.manifest, input.arm, trajectory);
      const evaluationDir = await writeConsequentialFactEvaluation({
        repoRoot: REPO_ROOT,
        workspace: input.workspace,
        sessionFile: inventory.currentSessionFile,
        specId: inventory.currentSpec.id,
        scenarioFile: SCENARIO,
        trajectoryFile,
        runId: input.runId,
      });
      const verdict = JSON.parse(await readFile(join(evaluationDir, 'verdict.json'), 'utf8')) as {
        judgments: Array<{ verdict: 'pass' | 'fail' }>;
      };
      const bundle = resolve(REPO_ROOT, input.manifest.artifactRoot, input.runId);
      await mkdir(bundle, { recursive: true });
      await cp(inventory.currentSessionFile, join(bundle, 'session.jsonl'));
      await cp(trajectoryDir, join(bundle, 'trajectory'), { recursive: true });
      await cp(evaluationDir, join(bundle, 'evaluation'), { recursive: true });
      await writeFile(join(bundle, 'viewport.txt'), input.viewport);
      await writeFile(
        join(bundle, 'run.json'),
        `${JSON.stringify({ runId: input.runId, arm: input.arm, cleanup: 'stopped' }, null, 2)}\n`,
      );
      return {
        runId: input.runId,
        valid: true,
        atomicVerdicts: verdict.judgments.map((item) => item.verdict),
      };
    },
  };
}

export function assertCampaignDirectiveEvidence(
  manifest: CampaignManifest,
  arm: CampaignArm,
  trajectory: ReturnType<typeof parseTrajectoryReport>,
): void {
  const directive = trajectory.directives.find((item) => item.id === manifest.directive.id);
  const expectedState = arm === 'control' ? 'provider_visible' : 'absent';
  if (directive?.resource !== manifest.directive.hash || !directive.state.includes(expectedState))
    throw new Error('mechanically invalid: provider directive evidence mismatches campaign arm');
}

export async function runConsequentialFactCampaignCli(argv: readonly string[]): Promise<number> {
  const { values } = parseArgs({ args: argv, options: { manifest: { type: 'string' } } });
  if (!values.manifest) throw new Error('campaign requires --manifest');
  await runConsequentialFactCampaign(JSON.parse(await readFile(resolve(values.manifest), 'utf8')) as unknown);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runConsequentialFactCampaignCli(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
