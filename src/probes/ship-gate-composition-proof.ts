import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertPortableRunId, portableCwd } from './portable-report.js';
import { launchPublicBrunchRpc } from './ship-gate-rpc-client.js';

const PROBE_ID = 'ship-gate-composition';
const SEEDS = ['workspace-alpha-grounding/base', 'workspace-beta-commitments/base'] as const;

interface WorkspaceActivationResult {
  readonly status: 'ready';
  readonly spec: { readonly id: number; readonly title: string };
  readonly session: { readonly id: string; readonly file: string };
}

interface WorkspaceSelectionResult {
  readonly requiresSelection: boolean;
  readonly specs: readonly { readonly spec: { readonly id: number; readonly title: string } }[];
}

interface GraphOverviewResult {
  readonly nodes: readonly { readonly id: number; readonly code?: string; readonly title: string }[];
  readonly edges: readonly unknown[];
  readonly lsn: number;
}

interface RuntimeStateResult {
  readonly state?: unknown;
  readonly posture?: unknown;
  readonly runtimeState?: unknown;
  readonly current?: unknown;
}

interface StepSummary {
  readonly name: string;
  readonly request: { readonly method: string; readonly params?: unknown };
  readonly response: unknown;
}

export interface ShipGateCompositionReport {
  readonly schemaVersion: 1;
  readonly probeId: typeof PROBE_ID;
  readonly runId: string;
  readonly generatedAt: string;
  readonly cwd: string;
  readonly cli: string;
  readonly setup: {
    readonly publicSeedCli: string;
    readonly seeds: readonly string[];
  };
  readonly alpha: {
    readonly specId: number;
    readonly sessionId: string;
    readonly nodeTitles: readonly string[];
    readonly lsn: number;
  };
  readonly beta: {
    readonly specId: number;
    readonly sessionId: string;
    readonly nodeTitles: readonly string[];
    readonly lsn: number;
  };
  readonly selectedSpecId: number;
  readonly betaTitlesAbsentFromAlpha: boolean;
  readonly runtimeStateObservable: boolean;
  readonly steps: readonly StepSummary[];
  readonly artifacts?: { readonly runDir: string; readonly reportJson: string };
}

export interface ShipGateCompositionOptions {
  readonly fixtureRoot?: string;
  readonly runId?: string;
  readonly workspaceCwd?: string;
  readonly cliPath?: string;
  readonly seedCliPath?: string;
}

export async function runShipGateCompositionProof(
  options: ShipGateCompositionOptions = {},
): Promise<ShipGateCompositionReport> {
  const runId = assertPortableRunId(options.runId ?? defaultRunId());
  const workspaceCwd = options.workspaceCwd ?? (await mkdtemp(join(tmpdir(), 'brunch-ship-gate-')));
  const cliPath = options.cliPath ?? defaultDistPath('app/brunch.js');
  const seedCliPath = options.seedCliPath ?? defaultDistPath('graph/seed-fixtures.js');
  const steps: StepSummary[] = [];

  for (const seed of SEEDS) {
    await runPublicSeedCli({ seedCliPath, workspaceCwd, seed });
  }

  const rpc = launchPublicBrunchRpc({ cliPath, cwd: workspaceCwd, timeoutMs: 8000 });
  try {
    const selection = await rpc.request<WorkspaceSelectionResult>('workspace.selectionState');
    steps.push({
      name: 'seeded workspace inventory',
      request: { method: 'workspace.selectionState' },
      response: summarizeSelection(selection),
    });
    if (selection.specs.length < 2) {
      throw new Error(`Expected public seed setup to create two specs; saw ${selection.specs.length}`);
    }
    const alphaSpec = findSpec(selection, 'Alpha Grounding');
    const betaSpec = findSpec(selection, 'Beta Commitments');

    const alpha = await rpc.request<WorkspaceActivationResult>('workspace.activate', {
      decision: { action: 'newSession', specId: alphaSpec.id },
    });
    steps.push({
      name: 'activate alpha through public RPC',
      request: {
        method: 'workspace.activate',
        params: { decision: { action: 'newSession', specId: alphaSpec.id } },
      },
      response: summarizeActivation(alpha),
    });

    const alphaOverview = await rpc.request<GraphOverviewResult>('graph.overview', { specId: alpha.spec.id });
    steps.push({
      name: 'read selected alpha graph overview',
      request: { method: 'graph.overview', params: { specId: alpha.spec.id } },
      response: summarizeOverview(alphaOverview),
    });

    const alphaRuntime = await rpc.request<RuntimeStateResult>('session.runtimeState', {
      specId: alpha.spec.id,
      sessionId: alpha.session.id,
    });
    steps.push({
      name: 'read alpha runtime posture observable',
      request: {
        method: 'session.runtimeState',
        params: { specId: alpha.spec.id, sessionId: alpha.session.id },
      },
      response: alphaRuntime,
    });

    const beta = await rpc.request<WorkspaceActivationResult>('workspace.activate', {
      decision: { action: 'newSession', specId: betaSpec.id },
    });
    steps.push({
      name: 'activate beta through public RPC',
      request: {
        method: 'workspace.activate',
        params: { decision: { action: 'newSession', specId: betaSpec.id } },
      },
      response: summarizeActivation(beta),
    });

    const selected = await rpc.request<WorkspaceSelectionResult>('workspace.selectionState');
    steps.push({
      name: 'confirm selected workspace inventory remains explicit',
      request: { method: 'workspace.selectionState' },
      response: summarizeSelection(selected),
    });

    const betaOverview = await rpc.request<GraphOverviewResult>('graph.overview', { specId: beta.spec.id });
    steps.push({
      name: 'read selected beta graph overview',
      request: { method: 'graph.overview', params: { specId: beta.spec.id } },
      response: summarizeOverview(betaOverview),
    });

    const alphaTitles = alphaOverview.nodes.map((node) => node.title).sort();
    const betaTitles = betaOverview.nodes.map((node) => node.title).sort();
    const betaTitlesAbsentFromAlpha = betaTitles.every((title) => !alphaTitles.includes(title));
    if (!betaTitlesAbsentFromAlpha) {
      throw new Error('Selected-spec graph overview leaked beta node titles into alpha overview');
    }
    if (!hasRuntimeObservable(alphaRuntime)) {
      throw new Error('session.runtimeState did not return a structured runtime posture observable');
    }

    const report: ShipGateCompositionReport = {
      schemaVersion: 1,
      probeId: PROBE_ID,
      runId,
      generatedAt: new Date().toISOString(),
      cwd: portableCwd(workspaceCwd),
      cli: 'node dist/app/brunch.js --mode rpc',
      setup: { publicSeedCli: 'node dist/graph/seed-fixtures.js', seeds: SEEDS },
      alpha: {
        specId: alpha.spec.id,
        sessionId: alpha.session.id,
        nodeTitles: alphaTitles,
        lsn: alphaOverview.lsn,
      },
      beta: {
        specId: beta.spec.id,
        sessionId: beta.session.id,
        nodeTitles: betaTitles,
        lsn: betaOverview.lsn,
      },
      selectedSpecId: beta.spec.id,
      betaTitlesAbsentFromAlpha,
      runtimeStateObservable: true,
      steps,
    };

    return options.fixtureRoot === undefined ? report : await writeArtifacts(options.fixtureRoot, report);
  } finally {
    await rpc.close();
  }
}

async function runPublicSeedCli(input: {
  readonly seedCliPath: string;
  readonly workspaceCwd: string;
  readonly seed: string;
}): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(
      process.execPath,
      [input.seedCliPath, '--workspace', input.workspaceCwd, '--seed', input.seed],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', rejectPromise);
    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`Public seed CLI failed for ${input.seed}: ${stderr}`));
      }
    });
  });
}

function findSpec(
  selection: WorkspaceSelectionResult,
  title: string,
): { readonly id: number; readonly title: string } {
  const spec = selection.specs.find((entry) => entry.spec.title.includes(title))?.spec;
  if (!spec) throw new Error(`Expected seeded spec titled ${title}`);
  return spec;
}

function summarizeSelection(selection: WorkspaceSelectionResult): unknown {
  return {
    requiresSelection: selection.requiresSelection,
    specs: selection.specs.map((entry) => entry.spec),
  };
}

function summarizeActivation(result: WorkspaceActivationResult): unknown {
  return {
    status: result.status,
    spec: result.spec,
    session: { id: result.session.id },
  };
}

function summarizeOverview(overview: GraphOverviewResult): unknown {
  return {
    nodeCount: overview.nodes.length,
    edgeCount: overview.edges.length,
    lsn: overview.lsn,
    nodeTitles: overview.nodes.map((node) => node.title).sort(),
  };
}

function hasRuntimeObservable(result: RuntimeStateResult): boolean {
  if (typeof result !== 'object' || result === null) return false;
  return Object.keys(result).length > 0;
}

async function writeArtifacts(
  fixtureRoot: string,
  report: ShipGateCompositionReport,
): Promise<ShipGateCompositionReport> {
  const runDir = join('runs', PROBE_ID, report.runId);
  const reportJson = join(runDir, 'report.json');
  await mkdir(join(fixtureRoot, runDir), { recursive: true });
  const persisted = { ...report, artifacts: { runDir, reportJson } } satisfies ShipGateCompositionReport;
  await writeFile(join(fixtureRoot, reportJson), `${JSON.stringify(persisted, null, 2)}\n`, 'utf8');
  return persisted;
}

function defaultRunId(): string {
  return new Date().toISOString().replace(/[:]/gu, '-');
}

function defaultDistPath(relativePath: string): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', relativePath);
}

async function main(): Promise<void> {
  const report = await runShipGateCompositionProof({ fixtureRoot: '.fixtures' });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
